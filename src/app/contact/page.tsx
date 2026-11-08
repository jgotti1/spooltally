"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";

export default function ContactPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (user && prefilledFor !== user.uid) {
    setPrefilledFor(user.uid);
    setName(user.displayName ?? "");
    setEmail(user.email ?? "");
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-svh flex-1 items-center justify-center bg-[#f5f8fc] dark:bg-[#05080e]">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
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
    <main className="flex min-h-svh flex-1 flex-col bg-[#f5f8fc] dark:bg-[#05080e]">
      <Header />
      <div className="mx-auto w-full max-w-xl flex-1 px-6 py-14 sm:px-10">
        <BackLink />
        <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-400">Support</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">Contact us</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Questions, bugs, or feedback — send a note and we&rsquo;ll get back to you.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-white/[0.03]">
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
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
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
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
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
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-lg shadow-blue-950/15 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
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
