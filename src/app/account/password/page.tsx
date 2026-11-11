"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";

function friendlyError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Your current password isn't right.";
      case "auth/weak-password":
        return "Choose a stronger password (at least 6 characters).";
      case "auth/too-many-requests":
        return "Too many attempts. Wait a few minutes and try again.";
    }
  }
  return "Couldn't change your password. Please try again.";
}

export default function ChangePasswordPage() {
  const { user, loading, viewingAs } = useAuth();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-svh flex-1 items-center justify-center st-page">
        <p className="st-loading">Loading…</p>
      </main>
    );
  }

  // The signed-in person's own login, never the customer being viewed.
  const self = auth?.currentUser ?? null;
  const hasPassword = !viewingAs && Boolean(self?.providerData.some((p) => p.providerId === "password"));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!self?.email) return;
    if (next.length < 8) return setError("Use at least 8 characters for the new password.");
    if (next !== confirm) return setError("The two new passwords don't match.");
    if (next === current) return setError("Pick a new password that's different from the current one.");
    setBusy(true);
    try {
      // Firebase requires a fresh sign-in before a password change, so confirm the current password first.
      await reauthenticateWithCredential(self, EmailAuthProvider.credential(self.email, current));
      await updatePassword(self, next);
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-white";
  const labelClass = "block text-sm font-semibold text-slate-700 dark:text-slate-300";

  return (
    <main className="flex min-h-svh flex-1 flex-col st-page">
      <Header />
      <div className="mx-auto w-full max-w-xl flex-1 px-6 py-14 sm:px-10">
        <BackLink />
        <p className="st-eyebrow">Account</p>
        <h1 className="mt-2 st-title">Change password</h1>

        <div className="mt-8 st-card p-6 sm:p-8">
          {!hasPassword ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {viewingAs
                ? "You're viewing a customer's account. Exit view-as to change your own password."
                : "You sign in with Google, so there's no SpoolTally password to change. Manage your password in your Google account."}
            </p>
          ) : done ? (
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Your password has been changed.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="current" className={labelClass}>Current password</label>
                <input id="current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="next" className={labelClass}>New password</label>
                <input id="next" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="confirm" className={labelClass}>Confirm new password</label>
                <input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
              </div>
              {error && <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="h-11 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                {busy ? "Saving…" : "Change password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
