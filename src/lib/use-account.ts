"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { accountStatus, type AccountStatusInfo } from "@/lib/account-status";

type AccountState = {
  /** Null while loading, or when the account record doesn't exist yet (brand-new signup, treated as an active trial). */
  info: AccountStatusInfo | null;
  /** When the trial ends, for display. */
  trialEndsAt: string | null;
  loading: boolean;
};

/**
 * Live access status for the account on screen (the customer's, during view-as). Reads the server-managed `users/{uid}`
 * doc, so a freeze, comp or trial change made by an admin shows up immediately. Firestore rules enforce the same rule.
 */
export function useAccountStatus(): AccountState {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [state, setState] = useState<{ uid: string | null } & AccountState>({ uid: null, info: null, trialEndsAt: null, loading: true });

  useEffect(() => {
    if (!uid || !db) return;
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const d = snap.data();
        if (!d) {
          setState({ uid, info: null, trialEndsAt: null, loading: false });
          return;
        }
        const trialEndsAt = d.trialEndsAt instanceof Timestamp ? d.trialEndsAt.toDate().toISOString() : null;
        setState({
          uid,
          trialEndsAt,
          loading: false,
          info: accountStatus({
            isComped: d.isComped === true,
            disabled: d.disabled === true,
            trialEndsAt,
            subscriptionStatus: typeof d.subscriptionStatus === "string" ? d.subscriptionStatus : "",
          }),
        });
      },
      () => setState({ uid, info: null, trialEndsAt: null, loading: false }),
    );
  }, [uid]);

  // A result for a previous account never applies to the current one.
  if (state.uid !== uid) return { info: null, trialEndsAt: null, loading: Boolean(uid) };
  return { info: state.info, trialEndsAt: state.trialEndsAt, loading: state.loading };
}
