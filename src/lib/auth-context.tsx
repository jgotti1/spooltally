"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import { setReadOnlyMode } from "@/lib/read-only";

const configError = new Error(
  "Firebase isn't configured yet. Add your project's keys to .env.local (see .env.local.example) and restart the dev server.",
);

/** The account an admin is looking at in read-only "view as" mode. */
export type ViewingAs = { uid: string; name: string; email: string };

const VIEW_AS_KEY = "spooltally:viewAs";

function readViewAs(): ViewingAs | null {
  try {
    const raw = window.sessionStorage.getItem(VIEW_AS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.uid === "string" ? { uid: parsed.uid, name: parsed.name ?? "", email: parsed.email ?? "" } : null;
  } catch {
    return null;
  }
}

type AuthContextValue = {
  /** The account the app should show: the real signed-in user, or the customer being viewed while an admin is in view-as mode. */
  user: User | null;
  loading: boolean;
  /** True only for the owner's account (verified `admin` custom claim). The server and Firestore rules enforce it again. */
  isAdmin: boolean;
  /** True only for the app owner, who alone may grant admin rights to others. */
  isOwner: boolean;
  /** Set while an admin is viewing a customer's data read-only. */
  viewingAs: ViewingAs | null;
  startViewAs: (target: ViewingAs) => void;
  stopViewAs: () => void;
  /** ID token of the real signed-in account, for calling the admin APIs. */
  getIdToken: () => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Creates the account and resolves to the new user's uid. */
  signUpWithEmail: (name: string, email: string, password: string) => Promise<string>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [realUser, setRealUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [profileVersion, setProfileVersion] = useState(0);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [viewAsTarget, setViewAsTarget] = useState<ViewingAs | null>(() => (typeof window === "undefined" ? null : readViewAs()));

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (nextUser) => {
      if (!nextUser) {
        // Signing out always ends "view as", so the next login (any account) starts as itself.
        try {
          window.sessionStorage.removeItem(VIEW_AS_KEY);
        } catch {}
        setViewAsTarget(null);
        setRealUser(null);
        setIsAdmin(false);
        setIsOwner(false);
        setLoading(false);
        return;
      }
      // Resolve the admin claim before finishing the load so admin-only UI never flashes in or out.
      nextUser
        .getIdTokenResult()
        .then((result) => ({ admin: result.claims.admin === true, owner: result.claims.owner === true }))
        .catch(() => ({ admin: false, owner: false }))
        .then(({ admin, owner }) => {
          setRealUser(nextUser);
          setIsAdmin(admin);
          setIsOwner(admin && owner);
          setLoading(false);
        });
      // Best effort: records last-active and creates the trial record on first visit. Never blocks the app.
      // If the server just granted the owner's admin rights, refresh the token so the Admin link appears right away.
      nextUser
        .getIdToken()
        .then((token) => fetch("/api/session", { method: "POST", headers: { Authorization: `Bearer ${token}` } }))
        .then((response) => response.json())
        .then(async (body) => {
          if (!body?.claimsUpdated) return;
          const refreshed = await nextUser.getIdTokenResult(true);
          setIsAdmin(refreshed.claims.admin === true);
          setIsOwner(refreshed.claims.admin === true && refreshed.claims.owner === true);
        })
        .catch(() => {});
    });
  }, []);

  const startViewAs = useCallback((target: ViewingAs) => {
    try {
      window.sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(target));
    } catch {}
    setViewAsTarget(target);
  }, []);

  const stopViewAs = useCallback(() => {
    try {
      window.sessionStorage.removeItem(VIEW_AS_KEY);
    } catch {}
    setViewAsTarget(null);
  }, []);

  // View-as only ever applies to a verified admin; anyone else with a stale sessionStorage entry is ignored.
  const viewingAs = isAdmin && realUser && viewAsTarget && viewAsTarget.uid !== realUser.uid ? viewAsTarget : null;

  // While viewing a customer, writes are refused up front and the page is marked so save/add controls are hidden (globals.css).
  const readOnly = Boolean(viewingAs);
  useEffect(() => {
    setReadOnlyMode(readOnly);
    document.documentElement.toggleAttribute("data-view-as", readOnly);
  }, [readOnly]);

  // The customer's identity, shaped like a Firebase user so every page works unchanged. It carries no credentials:
  // Firestore rules let an admin read their data but reject every write, so this mode is read-only by construction.
  const user = useMemo<User | null>(() => {
    void profileVersion;
    if (!viewingAs) return realUser;
    return {
      uid: viewingAs.uid,
      email: viewingAs.email || null,
      displayName: viewingAs.name || null,
      photoURL: null,
      providerData: [],
    } as unknown as User;
  }, [realUser, viewingAs, profileVersion]);

  const getIdToken = useCallback(async () => (realUser ? realUser.getIdToken() : null), [realUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin,
      isOwner,
      viewingAs,
      startViewAs,
      stopViewAs,
      getIdToken,
      signInWithGoogle: async () => {
        if (!auth) throw configError;
        await signInWithPopup(auth, googleProvider);
      },
      signInWithEmail: async (email, password) => {
        if (!auth) throw configError;
        await signInWithEmailAndPassword(auth, email, password);
      },
      signUpWithEmail: async (name, email, password) => {
        if (!auth) throw configError;
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) {
          await updateProfile(credential.user, { displayName: name.trim() });
          // The user object is mutated in place; bump a counter so consumers re-render with the new display name.
          setProfileVersion((v) => v + 1);
        }
        return credential.user.uid;
      },
      resetPassword: async (email) => {
        if (!auth) throw configError;
        await sendPasswordResetEmail(auth, email);
      },
      signOut: async () => {
        if (!auth) return;
        await firebaseSignOut(auth);
      },
    }),
    // profileVersion forces a fresh context value after an in-place profile update (the user object keeps its identity).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading, isAdmin, isOwner, viewingAs, startViewAs, stopViewAs, getIdToken, profileVersion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
