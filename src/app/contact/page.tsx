"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { LogoMark } from "@/components/Logo";

function ContactPageInner() {
  const { user, loading, getIdToken, viewingAs } = useAuth();
  const frozen = useSearchParams().get("reason") === "frozen";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(() => (frozen ? "My account is frozen. Can you take a look?" : ""));
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);

  if (user && prefilledFor !== user.uid) {
    setPrefilledFor(user.uid);
    setName(user.displayName ?? "");
    setEmail(user.email ?? "");
  }

  if (loading) {
    return (
      <main className="flex min-h-svh flex-1 items-center justify-center st-page">
        <p className="st-loading">Loading…</p>
      </main>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setStatus("sending");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name, email, message, website }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setStatus("idle");
        return;
      }
      setStatus("sent");
      setMessage("");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <main className="flex min-h-svh flex-1 flex-col st-page">
      {user ? (
        <Header />
      ) : (
        <header className="border-b border-slate-200 bg-white/90 dark:border-white/10 dark:bg-[#05080e]/90">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-3" aria-label="SpoolTally sign in">
              <LogoMark className="h-10 w-10 rounded-xl shadow-sm" />
              <span className="text-2xl font-bold tracking-[-0.03em] text-slate-950 dark:text-white">
                Spool<span className="text-blue-600 dark:text-blue-400">Tally</span>
              </span>
            </Link>
            <Link href="/" className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Back to sign in
            </Link>
          </div>
        </header>
      )}
      <div className="mx-auto w-full max-w-xl flex-1 px-6 py-14 sm:px-10">
        <div className="st-pagehead">
          {user && <BackLink />}
          <p className="st-eyebrow">Support</p>
          <h1 className="mt-2 st-title">Contact us</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {frozen
              ? "Your account is frozen. Tell us your email address and what you need, and we'll get back to you."
              : "Questions, bugs, or feedback — send a note and we’ll get back to you."}
          </p>
        </div>

        <div className="mt-8 st-card p-6 sm:p-8">
          {status === "sent" ? (
            <div className="py-6 text-center">
              <p className="text-lg font-semibold text-slate-900 dark:text-white">Message sent</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Thanks for reaching out — we&rsquo;ll reply to {email} soon.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="mt-5 text-sm font-semibold text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Honeypot: invisible to people, tempting to bots. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Name
                </label>
                <input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Maker"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 dark:bg-white/[0.03] px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 dark:bg-white/[0.03] px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label htmlFor="message" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Message
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help?"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 dark:bg-white/[0.03] p-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "sending" || !!viewingAs}
                title={viewingAs ? "You're viewing a customer's account. Exit view-as to send a message." : undefined}
                className="flex h-12 w-full items-center justify-center st-btn-primary disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "sending" ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={null}>
      <ContactPageInner />
    </Suspense>
  );
}
