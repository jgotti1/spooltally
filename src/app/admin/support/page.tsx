"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/admin/AdminNav";
import { SupportList } from "@/components/admin/SupportList";
import type { SupportMessage } from "@/lib/account-status";
import { fetchSupportMessages } from "@/lib/admin-api";

type Filter = "open" | "resolved" | "all";

export default function AdminSupportPage() {
  const { user, loading, isAdmin, getIdToken } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.replace(user ? "/dashboard" : "/");
  }, [loading, user, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    fetchSupportMessages(getIdToken)
      .then((next) => active && setMessages(next))
      .catch((err: Error) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [isAdmin, getIdToken]);

  const openCount = useMemo(() => (messages ?? []).filter((m) => m.status === "open").length, [messages]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (messages ?? [])
      .filter((m) => filter === "all" || m.status === filter)
      .filter((m) => !query || [m.name, m.email, m.message].some((field) => field.toLowerCase().includes(query)));
  }, [messages, filter, search]);

  if (loading || !user || !isAdmin) {
    return (
      <main className="flex min-h-svh flex-1 items-center justify-center st-page">
        <p className="st-loading">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-1 flex-col st-page">
      <Header />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-8">
        <AdminNav />
        <div className="st-pagehead mt-5">
          <p className="st-eyebrow">Admin</p>
          <h1 className="mt-1 st-title">Support</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Messages from the Contact page. {messages ? `${openCount} open.` : ""} Replies are emailed to the customer.
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          {(["open", "resolved", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${
                filter === f
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, or message"
          aria-label="Search support messages"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 placeholder:text-slate-400 sm:w-72 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        </div>
        {error && (
          <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>
        )}
        <div className="mt-5">
          {messages ? (
            <SupportList
              messages={visible}
              getIdToken={getIdToken}
              showUserLink
              onChange={(next) => setMessages((all) => (all ?? []).map((x) => (x.id === next.id ? next : x)))}
            />
          ) : (
            !error && <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
          )}
        </div>
      </div>
    </main>
  );
}
