"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { ListScroll, Pager, usePaged } from "@/components/Pager";
import { AdminNav } from "@/components/admin/AdminNav";
import { StatusBadge, formatAdminDate, formatAdminDateTime } from "@/components/admin/StatusBadge";
import { accountStatus, type AccountStatus, type AdminUserSummary } from "@/lib/account-status";
import { fetchAdminUsers } from "@/lib/admin-api";

type Filter = "all" | "trial" | "subscribed" | "comped" | "past_due" | "locked";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "trial", label: "Free trial" },
  { id: "subscribed", label: "Paid" },
  { id: "comped", label: "Comped" },
  { id: "past_due", label: "Behind on payment" },
  { id: "locked", label: "Locked" },
];

function matchesFilter(status: AccountStatus, locked: boolean, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "locked") return locked;
  return status === filter;
}

export default function AdminUsersPage() {
  const { user, loading, isAdmin, getIdToken } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.replace(user ? "/dashboard" : "/");
  }, [loading, user, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    fetchAdminUsers(getIdToken)
      .then((next) => {
        if (active) setUsers(next);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, getIdToken]);

  const rows = useMemo(
    () => (users ?? []).map((u) => ({ user: u, info: accountStatus(u) })),
    [users],
  );

  const counts = useMemo(() => {
    const tally = { total: rows.length, trial: 0, subscribed: 0, comped: 0, past_due: 0, locked: 0 };
    for (const { info } of rows) {
      if (info.status === "trial") tally.trial += 1;
      if (info.status === "subscribed") tally.subscribed += 1;
      if (info.status === "comped") tally.comped += 1;
      if (info.status === "past_due") tally.past_due += 1;
      if (info.locked) tally.locked += 1;
    }
    return tally;
  }, [rows]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter(({ info }) => matchesFilter(info.status, info.locked, filter))
      .filter(({ user: u }) => !query || [u.name, u.email, u.shopName].some((field) => field.toLowerCase().includes(query)))
      .sort((a, b) => (b.user.lastLogin ?? b.user.lastSignIn ?? "").localeCompare(a.user.lastLogin ?? a.user.lastSignIn ?? ""));
  }, [rows, search, filter]);

  const paged = usePaged(visible, `${filter}|${search}`);

  if (loading || !user || !isAdmin) {
    return (
      <main className="flex min-h-svh flex-1 items-center justify-center st-page">
        <p className="st-loading">Loading…</p>
      </main>
    );
  }

  const stat = (label: string, value: number, tone = "text-slate-950 dark:text-white") => (
    <div className="st-card p-4">
      <p className={`text-2xl font-semibold tracking-[-0.02em] ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );

  return (
    <main className="flex min-h-svh flex-1 flex-col st-page">
      <Header />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-8">
        <AdminNav />
        <h1 className="mt-6 st-title">Users</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Everyone who has signed up. Select a user to see details, comp them, or view their account.</p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stat("Total users", counts.total)}
          {stat("On free trial", counts.trial, "text-blue-600 dark:text-blue-400")}
          {stat("Paid", counts.subscribed, "text-emerald-600 dark:text-emerald-400")}
          {stat("Comped (free)", counts.comped)}
          {stat("Behind on payment", counts.past_due, "text-amber-600 dark:text-amber-400")}
          {stat("Locked", counts.locked, "text-rose-600 dark:text-rose-400")}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  filter === f.id
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or shop"
            aria-label="Search users"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 placeholder:text-slate-400 sm:w-72 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>

        {error && (
          <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>
        )}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-slate-200 px-5 py-3 text-[11px] font-bold tracking-[0.12em] text-slate-400 uppercase md:grid dark:border-white/10">
            <span>User</span>
            <span>Status</span>
            <span>Trial ends</span>
            <span>Last active</span>
            <span>Signed up</span>
          </div>
          {users === null && !error && <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">Loading users…</p>}
          {users !== null && visible.length === 0 && <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">No users match.</p>}
          <ListScroll page={paged.pager.page}>
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {paged.pageItems.map(({ user: u, info }) => (
              <li key={u.uid}>
                <Link
                  href={`/admin/users/${u.uid}`}
                  className="grid gap-2 px-5 py-4 transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-4 dark:hover:bg-white/[0.04]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">{u.name || u.email || "Unnamed user"}
                      {u.isAdmin && (
                        <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 align-middle text-[10px] font-bold tracking-wide text-white uppercase dark:bg-white dark:text-slate-950">
                          {u.isOwner ? "Owner" : "Admin"}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {u.name ? u.email : ""}
                      {u.shopName ? `${u.name ? " · " : ""}${u.shopName}` : ""}
                    </span>
                  </span>
                  <span>
                    <StatusBadge info={info} />
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    <span className="md:hidden text-xs text-slate-400">Trial ends </span>
                    {u.isComped || u.isOwner ? "—" : formatAdminDate(u.trialEndsAt)}
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    <span className="md:hidden text-xs text-slate-400">Last active </span>
                    {formatAdminDateTime(u.lastLogin ?? u.lastSignIn)}
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    <span className="md:hidden text-xs text-slate-400">Signed up </span>
                    {formatAdminDate(u.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          </ListScroll>
          <Pager {...paged.pager} noun="users" className="border-t border-slate-100 px-5 py-3 dark:border-white/5" />
        </div>
      </div>
    </main>
  );
}
