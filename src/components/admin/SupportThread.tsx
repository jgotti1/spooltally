"use client";

import { useState } from "react";
import Link from "next/link";
import type { SupportMessage } from "@/lib/account-status";
import { updateSupportMessage } from "@/lib/admin-api";

/** One support message with its replies, a reply box, and resolve/reopen. */
export function SupportThread({
  message,
  getIdToken,
  onChange,
  showUserLink,
}: {
  message: SupportMessage;
  getIdToken: () => Promise<string | null>;
  onChange: (next: SupportMessage) => void;
  showUserLink?: boolean;
}) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(change: { reply?: string; status?: "open" | "resolved" }) {
    setBusy(true);
    setError("");
    try {
      onChange(await updateSupportMessage(getIdToken, message.id, change));
      setReply("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  const resolved = message.status === "resolved";
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-950 dark:text-white">
            {message.name || "Unnamed"} <span className="font-normal text-slate-500 dark:text-slate-400">· {message.email}</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {message.createdAt ? new Date(message.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : ""}
            {showUserLink && message.ownerId && (
              <Link href={`/admin/users/${message.ownerId}`} className="ml-2 text-blue-600 hover:underline dark:text-blue-400">
                View user
              </Link>
            )}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
            resolved
              ? "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
              : "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20"
          }`}
        >
          {resolved ? "Resolved" : "Open"}
        </span>
      </header>
      <p className="mt-3 text-sm whitespace-pre-wrap text-slate-800 dark:text-slate-200">{message.message}</p>

      {message.replies.map((r, i) => (
        <div key={i} className="mt-3 rounded-xl border-l-4 border-blue-400 bg-blue-50/60 px-4 py-2.5 text-sm dark:bg-blue-500/5">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
            Reply{r.byEmail ? ` from ${r.byEmail}` : ""} · {r.at ? new Date(r.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : ""}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-slate-800 dark:text-slate-200">{r.message}</p>
        </div>
      ))}

      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={3}
        placeholder={`Reply to ${message.name || message.email} by email…`}
        aria-label="Reply"
        className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
      />
      {error && <p className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !reply.trim()}
          onClick={() => void save({ reply })}
          className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
        >
          {busy ? "Sending…" : "Send reply & resolve"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save({ status: resolved ? "open" : "resolved" })}
          className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
        >
          {resolved ? "Reopen" : "Mark resolved"}
        </button>
      </div>
    </article>
  );
}
