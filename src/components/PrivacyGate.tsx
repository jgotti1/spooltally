"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAccountStatus } from "@/lib/use-account";
import { PRIVACY_VERSION } from "@/lib/privacy";
import { PrivacyPanel } from "@/components/PrivacyPanel";

/**
 * Blocks the app behind the privacy summary until the signed-in person acknowledges it: every new account sees it
 * right after signing up, and everyone sees it again when PRIVACY_VERSION is bumped. The acknowledgment is recorded
 * server-side (/api/privacy-ack) with a timestamp and version. Admins viewing a customer's account are never asked
 * on the customer's behalf.
 */
export function PrivacyGate() {
  const { user, viewingAs, signOut, getIdToken } = useAuth();
  const { ready, loading, privacyVersion } = useAccountStatus();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Tied to the account, so a different person signing in on the same page load is still asked.
  const [acceptedFor, setAcceptedFor] = useState<string | null>(null);

  const needs =
    Boolean(user) && !viewingAs && ready && !loading && (privacyVersion ?? 0) < PRIVACY_VERSION && acceptedFor !== user?.uid;

  useEffect(() => {
    if (!needs) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [needs]);

  if (!needs || !user) return null;
  const uid = user.uid;

  async function acknowledge() {
    setBusy(true);
    setError("");
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not signed in.");
      const response = await fetch("/api/privacy-ack", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Couldn't save that. Please try again.");
      }
      setAcceptedFor(uid);
      setChecked(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-gate-title"
      className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/70 px-4 py-6 backdrop-blur-md sm:py-10"
    >
      <div className="st-rise mx-auto w-full max-w-2xl overflow-hidden rounded-[24px] bg-white shadow-[0_40px_90px_-30px_rgba(6,23,37,0.7)] ring-1 ring-slate-900/[0.06] dark:bg-[#0b1420] dark:ring-white/10">
        <div className="px-6 pt-7 pb-1 sm:px-8">
          <p className="st-eyebrow">Before you start</p>
          <h2 id="privacy-gate-title" className="st-title mt-1 text-[1.7rem] sm:text-[2rem]">
            How SpoolTally handles your information
          </h2>
          <p className="st-lede mt-2">Please take a minute to read this, then confirm below to continue to your workshop.</p>
        </div>

        <div className="px-6 pb-2 sm:px-8">
          <PrivacyPanel hideContact />
        </div>

        <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:px-8 dark:border-white/10 dark:bg-white/[0.03]">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 font-medium text-slate-800 dark:text-slate-100">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>I&rsquo;ve read this and understand how SpoolTally handles my information and payments.</span>
          </label>
          {error && <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" disabled={!checked || busy} onClick={() => void acknowledge()} className="st-btn-primary h-11 px-6">
              {busy ? "Saving…" : "Continue"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void signOut()}
              className="h-11 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:text-slate-900 disabled:opacity-60 dark:text-slate-400 dark:hover:text-white"
            >
              Sign out instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
