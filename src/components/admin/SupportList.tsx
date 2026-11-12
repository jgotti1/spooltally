"use client";

import { useEffect, useState } from "react";
import type { SupportMessage } from "@/lib/account-status";
import { SupportThread } from "@/components/admin/SupportThread";
import { ListScroll, Pager, usePaged } from "@/components/Pager";

function shortDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}

/**
 * Compact list of support messages. Double-click a row (or press Enter, or use its Open button on touch screens) to open
 * the full message with its replies and the reply box.
 */
export function SupportList({
  messages,
  getIdToken,
  onChange,
  showUserLink,
  emptyText = "Nothing here.",
}: {
  messages: SupportMessage[];
  getIdToken: () => Promise<string | null>;
  onChange: (next: SupportMessage) => void;
  showUserLink?: boolean;
  emptyText?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = messages.find((m) => m.id === openId) ?? null;
  const paged = usePaged(messages);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!messages.length) return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="hidden grid-cols-[6.5rem_minmax(0,1.3fr)_minmax(0,2fr)_5.5rem_4rem_4.5rem] gap-4 border-b border-slate-200 px-5 py-3 text-[11px] font-bold tracking-[0.12em] text-slate-400 uppercase md:grid dark:border-white/10">
          <span>Date</span>
          <span>From</span>
          <span>Message</span>
          <span>Status</span>
          <span>Replies</span>
          <span />
        </div>
        <ListScroll page={paged.pager.page}>
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {paged.pageItems.map((m) => {
            const resolved = m.status === "resolved";
            return (
              <li
                key={m.id}
                tabIndex={0}
                title="Double-click to open"
                onDoubleClick={() => setOpenId(m.id)}
                onKeyDown={(e) => e.key === "Enter" && setOpenId(m.id)}
                className="grid cursor-pointer gap-1 px-5 py-3.5 text-sm outline-none select-none hover:bg-slate-50 focus-visible:bg-slate-50 md:grid-cols-[6.5rem_minmax(0,1.3fr)_minmax(0,2fr)_5.5rem_4rem_4.5rem] md:items-center md:gap-4 dark:hover:bg-white/[0.04] dark:focus-visible:bg-white/[0.04]"
              >
                <span className="text-xs text-slate-500 dark:text-slate-400">{shortDate(m.createdAt)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-950 dark:text-white">{m.name || "Unnamed"}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{m.email}</span>
                </span>
                <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">{m.message}</span>
                <span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                      resolved
                        ? "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
                        : "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20"
                    }`}
                  >
                    {resolved ? "Resolved" : "Open"}
                  </span>
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{m.replies.length ? m.replies.length : "—"}</span>
                <span>
                  <button
                    type="button"
                    onClick={() => setOpenId(m.id)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                  >
                    Open
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        </ListScroll>
        <Pager {...paged.pager} noun="messages" className="border-t border-slate-100 px-5 py-2.5 dark:border-white/5" />
        <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-400 dark:border-white/5 dark:text-slate-500">
          Double-click a message to read it and reply.
        </p>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Support message"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-8 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && setOpenId(null)}
        >
          <div className="w-full max-w-2xl">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-slate-800 shadow hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <SupportThread message={open} getIdToken={getIdToken} onChange={onChange} showUserLink={showUserLink} />
          </div>
        </div>
      )}
    </>
  );
}
