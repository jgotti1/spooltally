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
  /** False when the account record couldn't be read (offline, error), so callers don't act on missing data. */
  ready: boolean;
  /** The privacy summary version this account has acknowledged; null when none yet. */
  privacyVersion: number | null;
  privacyAcknowledgedAt: string | null;
};

const EMPTY = { info: null, trialEndsAt: null, ready: false, privacyVersion: null, privacyAcknowledgedAt: null } as const;

/**
 * Live access status for the account on screen (the customer's, during view-as). Reads the server-managed `users/{uid}`
 * doc, so a freeze, comp or trial change made by an admin shows up immediately. Firestore rules enforce the same rule.
 */
export function useAccountStatus(): AccountState {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [state, setState] = useState<{ uid: string | null } & AccountState>({ uid: null, ...EMPTY, loading: true });

  useEffect(() => {
    if (!uid || !db) return;
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const d = snap.data();
        if (!d) {
          // No record yet is a normal brand-new signup (the server creates it a moment later).
          setState({ uid, ...EMPTY, loading: false, ready: true });
          return;
        }
        const trialEndsAt = d.trialEndsAt instanceof Timestamp ? d.trialEndsAt.toDate().toISOString() : null;
        setState({
          uid,
          trialEndsAt,
          loading: false,
          ready: true,
          privacyVersion: typeof d.privacyVersion === "number" ? d.privacyVersion : null,
          privacyAcknowledgedAt: d.privacyAcknowledgedAt instanceof Timestamp ? d.privacyAcknowledgedAt.toDate().toISOString() : null,
          info: accountStatus({
            isComped: d.isComped === true,
            disabled: d.disabled === true,
            trialEndsAt,
            subscriptionStatus: typeof d.subscriptionStatus === "string" ? d.subscriptionStatus : "",
          }),
        });
      },
      () => setState({ uid, ...EMPTY, loading: false }),
    );
  }, [uid]);

  // A result for a previous account never applies to the current one.
  if (state.uid !== uid) return { ...EMPTY, loading: Boolean(uid) };
  return state;
}
