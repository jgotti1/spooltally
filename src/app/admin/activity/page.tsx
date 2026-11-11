"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/admin/AdminNav";
import { AuditList } from "@/components/admin/AuditList";
import { AUDIT_LABELS, type AuditEntry } from "@/lib/account-status";
import { downloadHistory, fetchHistoryPage, purgeHistory, type HistoryKindFilter } from "@/lib/admin-api";

const KINDS: { id: HistoryKindFilter; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "admin", label: "Admin actions" },
  { id: "system", label: "User activity" },
];

const selectClass =
  "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100";

export default function AdminActivityPage() {
  const { user, loading, isAdmin, isOwner, getIdToken } = useAuth();
  const router = useRouter();
  const [kind, setKind] = useState<HistoryKindFilter>("all");
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [exportDays, setExportDays] = useState("0");
  const [exporting, setExporting] = useState(false);
  const [purgeDays, setPurgeDays] = useState("90");
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [purging, setPurging] = useState(false);
  // Bumped after a purge to reload the list from the top.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.replace(user ? "/dashboard" : "/");
  }, [loading, user, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(null);
    setError("");
    fetchHistoryPage(getIdToken, { kind })
      .then((page) => {
        if (!active) return;
        setEntries(page.entries);
        setCursor(page.nextCursor);
      })
      .catch((err: Error) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [isAdmin, getIdToken, kind, reloadKey]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchHistoryPage(getIdToken, { kind, cursor });
      setEntries((prev) => [...(prev ?? []), ...page.entries]);
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load more.");
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, getIdToken, kind]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!entries || !query) return entries ?? [];
    return entries.filter((e) =>
      [AUDIT_LABELS[e.action] ?? e.action, e.actorEmail, e.targetUid ?? "", JSON.stringify(e.details)].some((field) => field.toLowerCase().includes(query)),
    );
  }, [entries, search]);

  async function handleExport() {
    setExporting(true);
    setError("");
    setNotice("");
    try {
      await downloadHistory(getIdToken, kind, Number(exportDays) || null);
      setNotice("Download started.");
      setReloadKey((n) => n + 1); // the export itself was logged
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't export the history.");
    } finally {
      setExporting(false);
    }
  }

  async function handlePurge() {
    const days = Number(purgeDays) || null;
    const scope = days ? `everything older than ${days} days` : "the ENTIRE history";
    if (!window.confirm(`Permanently delete ${scope}? This cannot be undone. (Export it first if you might need it.)`)) return;
    setPurging(true);
    setError("");
    setNotice("");
    try {
      const deleted = await purgeHistory(getIdToken, days, purgeConfirm);
      setNotice(`Purged ${deleted} entr${deleted === 1 ? "y" : "ies"}.`);
      setPurgeConfirm("");
      setReloadKey((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't purge the history.");
    } finally {
      setPurging(false);
    }
  }

  if (loading || !user || !isAdmin) {
    return (
      <main className="flex min-h-svh flex-1 items-center justify-center bg-[#f5f8fc] dark:bg-[#05080e]">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-1 flex-col bg-[#f5f8fc] dark:bg-[#05080e]">
      <Header />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-8">
        <AdminNav />
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">History</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Everything recorded about the system, newest first, kept for 90 days and then deleted automatically: what admins did, plus signups, sign-ins and support messages from users. Only admins can see
          this. Changes to customers&rsquo; own inventory and projects aren&rsquo;t logged.
        </p>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={kind === k.id}
                onClick={() => setKind(k.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                  kind === k.id
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search loaded entries"
              aria-label="Search history"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 placeholder:text-slate-400 sm:w-60 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            <select value={exportDays} onChange={(e) => setExportDays(e.target.value)} aria-label="Export period" className={selectClass}>
              <option value="0">All time</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExport()}
              className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950"
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>
        )}
        {notice && (
          <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p>
        )}

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-2 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          {entries ? (
            <AuditList entries={visible} showTarget showKind />
          ) : (
            !error && <p className="py-3 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
          )}
        </div>
        {entries && (
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing {visible.length}
              {search.trim() ? ` of ${entries.length} loaded` : ""} entries{cursor ? "" : " · end of history"}
            </span>
            {cursor && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}

        {isOwner && (
          <section className="mt-10 rounded-2xl border-2 border-rose-300 bg-rose-50/60 p-5 dark:border-rose-500/40 dark:bg-rose-500/5">
            <h2 className="text-sm font-bold text-rose-800 dark:text-rose-300">Danger zone · Purge history</h2>
            <p className="mt-2 text-sm text-rose-900 dark:text-rose-200">
              History older than 90 days is already deleted automatically every day. This deletes log entries sooner, admin actions and user activity alike. <strong>This cannot be undone</strong>, so export first if you might
              need them. The purge itself is recorded afterwards. Only the owner can do this.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                Delete
                <select value={purgeDays} onChange={(e) => setPurgeDays(e.target.value)} className={`${selectClass} mt-1 block`}>
                  <option value="30">Older than 30 days</option>
                  <option value="90">Older than 90 days</option>
                  <option value="365">Older than 1 year</option>
                  <option value="0">Everything</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                Type <span className="font-mono">PURGE</span> to confirm
                <input
                  value={purgeConfirm}
                  onChange={(e) => setPurgeConfirm(e.target.value)}
                  autoComplete="off"
                  className="mt-1 block h-10 w-44 rounded-xl border border-rose-300 bg-white px-3 text-sm dark:border-rose-500/40 dark:bg-white/5 dark:text-white"
                />
              </label>
              <button
                type="button"
                disabled={purging || purgeConfirm !== "PURGE"}
                onClick={() => void handlePurge()}
                className="h-10 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {purging ? "Purging…" : "Purge history"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
