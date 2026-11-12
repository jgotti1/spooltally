"use client";

import Link from "next/link";
import { AUDIT_LABELS, type AuditEntry } from "@/lib/account-status";
import { formatAdminDate } from "@/components/admin/StatusBadge";
import { ListScroll, Pager, usePaged } from "@/components/Pager";

function detailText(entry: AuditEntry): string {
  const d = entry.details;
  if (typeof d.trialEndsAt === "string") return `→ ${formatAdminDate(d.trialEndsAt)}${typeof d.days === "number" ? ` (+${d.days} days)` : ""}`;
  if (entry.action === "delete_account" && typeof d.email === "string") return d.email;
  if (entry.action === "purge_history") return `${d.automatic ? "automatic · " : ""}${d.deleted ?? 0} entries removed${typeof d.olderThanDays === "number" ? ` (older than ${d.olderThanDays} days)` : " (everything)"}`;
  if (entry.action === "export_history") return `${d.rows ?? 0} rows`;
  return "";
}

/** Activity rows. `showTarget` adds a link to the affected account (used on the global log, not on a user's own page). */
export function AuditList({
  entries,
  showTarget,
  showKind,
  resetKey = "",
}: {
  entries: AuditEntry[];
  showTarget?: boolean;
  showKind?: boolean;
  /** Changing this (a filter or search) sends the list back to page 1. */
  resetKey?: string;
}) {
  const paged = usePaged(entries, resetKey);
  if (!entries.length) return <p className="py-2 text-sm text-slate-500 dark:text-slate-400">Nothing to show.</p>;
  return (
    <>
    <ListScroll page={paged.pager.page}>
    <ul className="divide-y divide-slate-100 dark:divide-white/5">
      {paged.pageItems.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <span className="min-w-0">
            {showKind && (
              <span
                className={`mr-2 inline-block rounded-full px-2 py-0.5 align-middle text-[10px] font-bold tracking-wide uppercase ${
                  entry.kind === "admin"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                }`}
              >
                {entry.kind === "admin" ? "Admin" : "User"}
              </span>
            )}
            <span className="font-semibold text-slate-900 dark:text-slate-100">{AUDIT_LABELS[entry.action] ?? entry.action}</span>
            {detailText(entry) && <span className="text-slate-500 dark:text-slate-400"> {detailText(entry)}</span>}
            {showTarget && entry.targetUid && entry.action !== "delete_account" && (
              <Link href={`/admin/users/${entry.targetUid}`} className="ml-2 text-blue-600 hover:underline dark:text-blue-400">
                View user
              </Link>
            )}
          </span>
          <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
            {entry.actorEmail || entry.actorUid} · {entry.at ? new Date(entry.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "just now"}
          </span>
        </li>
      ))}
    </ul>
    </ListScroll>
    <Pager {...paged.pager} className="border-t border-slate-100 py-3 dark:border-white/5" />
    </>
  );
}
