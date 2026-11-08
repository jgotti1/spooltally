"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { useAuth } from "@/lib/auth-context";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import styles from "@/app/page.module.css";

function MailIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7.5 12 13l8-5.5" /><rect x="3.5" y="5" width="17" height="14" rx="3" /></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4.5" y="10" width="15" height="10" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14.5v2" /></svg>;
}

function UserIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8.5" r="3.25" /><path d="M5 19.5c0-3.3 3.1-6 7-6s7 2.7 7 6" /></svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h11M11 6l4 4-4 4" /></svg>;
}

function friendlyAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-email":
        return "That email address doesn't look right.";
      case "auth/user-not-found":
      case "auth/invalid-credential":
      case "auth/wrong-password":
        return "Email or password is incorrect.";
      case "auth/email-already-in-use":
        return "An account already exists for that email. Try signing in instead.";
      case "auth/weak-password":
        return "Password should be at least 6 characters.";
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return "";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function LoginForm() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | "reset" | null>(null);

  async function handleGoogle() {
    setError("");
    setNotice("");
    setBusy("google");
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (err) {
      const message = friendlyAuthError(err);
      if (message) setError(message);
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy("email");
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(name, email, password);
      }
      router.push("/dashboard");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setNotice("");
    if (!email) {
      setError("Enter your email address first, then click “Forgot password?”");
      return;
    }
    setBusy("reset");
    try {
      await resetPassword(email);
      setNotice("Password reset email sent — check your inbox.");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`${styles.authCard} rounded-[28px] border border-white/80 bg-white/88 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur-xl sm:p-9 dark:shadow-black/40`}>
      <div className="mb-7">
        <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-400">
          {mode === "signin" ? "Welcome back" : "Get started"}
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-slate-950 dark:text-white">
          {mode === "signin" ? "Sign in to your workshop" : "Start your free trial"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {mode === "signin" ? "Your inventory, estimates, and projects are ready." : "7 days free. No credit card required."}
        </p>
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy !== null}
        className={`${styles.googleButton} flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:shadow-none`}
      >
        <GoogleIcon className="h-[18px] w-[18px]" />
        {busy === "google" ? "Connecting…" : "Continue with Google"}
      </button>

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        <span className="text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase dark:text-slate-500">or use email</span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Full name</label>
            <div className="relative">
              <span className={`${styles.inputIcon} pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500`}><UserIcon /></span>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                placeholder="Jane Maker"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${styles.input} h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pr-4 pl-12 text-sm text-slate-950 placeholder:text-slate-400 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500`}
              />
            </div>
          </div>
        )}
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Email address</label>
          <div className="relative">
            <span className={`${styles.inputIcon} pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500`}><MailIcon /></span>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${styles.input} h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pr-4 pl-12 text-sm text-slate-950 placeholder:text-slate-400 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500`}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-4">
            <label htmlFor="password" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
            {mode === "signin" && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={busy !== null}
                className="rounded text-xs font-semibold text-blue-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 dark:text-blue-400"
              >
                {busy === "reset" ? "Sending…" : "Forgot password?"}
              </button>
            )}
          </div>
          <div className="relative">
            <span className={`${styles.inputIcon} pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500`}><LockIcon /></span>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              placeholder={mode === "signin" ? "Enter your password" : "Create a password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${styles.input} h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pr-4 pl-12 text-sm text-slate-950 placeholder:text-slate-400 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500`}
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>
        )}
        {notice && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p>
        )}

        <button
          type="submit"
          disabled={busy !== null}
          className={`${styles.submitButton} group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-lg shadow-blue-950/15 disabled:cursor-not-allowed disabled:opacity-70`}
        >
          {busy === "email" ? (mode === "signin" ? "Signing in…" : "Creating account…") : mode === "signin" ? "Sign in" : "Create account"}
          <span className="h-4 w-4 transition-transform group-hover:translate-x-1"><ArrowIcon /></span>
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {mode === "signin" ? (
          <>
            New to SpoolTally?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError("");
                setNotice("");
              }}
              className="font-semibold text-blue-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-400"
            >
              Start your free trial
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError("");
                setNotice("");
              }}
              className="font-semibold text-blue-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-400"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
