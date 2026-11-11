"use client";

import { useState } from "react";
import type { SupportMessage } from "@/lib/account-status";
import { SupportList } from "@/components/admin/SupportList";

/**
 * A customer's support messages on their admin page. Collapsed unless something needs attention, and resolved messages
 * sit behind their own tab so finished conversations don't clutter the page.
 */
export function SupportSection({
  messages,
  getIdToken,
  onChange,
}: {
  messages: SupportMessage[] | null;
  getIdToken: () => Promise<string | null>;
  onChange: (next: SupportMessage) => void;
}) {
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"open" | "resolved">("open");

  const list = messages ?? [];
  const openCount = list.filter((m) => m.status === "open").length;
  const resolvedCount = list.length - openCount;
  // Until the admin chooses, show the section only when there's something waiting on a reply.
  const isOpen = expanded ?? openCount > 0;
  const shown = list.filter((m) => m.status === tab);

  const summary = !messages
    ? "Loading…"
    : list.length === 0
      ? "None"
      : `${openCount} open${resolvedCount ? ` · ${resolvedCount} resolved` : ""}`;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setExpanded(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Support messages <span className="font-normal text-slate-500 dark:text-slate-400">· {summary}</span>
        </span>
        <span aria-hidden="true" className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {isOpen && messages && (
        <div className="mt-4">
          {list.length > 0 && (
            <div className="mb-3 flex gap-1.5">
              {(["open", "resolved"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tab === t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${
                    tab === t
                      ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
                  }`}
                >
                  {t} ({t === "open" ? openCount : resolvedCount})
                </button>
              ))}
            </div>
          )}
          <SupportList
            messages={shown}
            getIdToken={getIdToken}
            onChange={onChange}
            emptyText={list.length === 0 ? "They haven't contacted support." : tab === "open" ? "Nothing waiting on a reply." : "No resolved messages."}
          />
        </div>
      )}
    </section>
  );
}
