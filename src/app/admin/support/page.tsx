"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/admin/AdminNav";
import { SupportThread } from "@/components/admin/SupportThread";
import type { SupportMessage } from "@/lib/account-status";
import { fetchSupportMessages } from "@/lib/admin-api";

type Filter = "open" | "resolved" | "all";

export default function AdminSupportPage() {
  const { user, loading, isAdmin, getIdToken } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("open");

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
  const visible = useMemo(() => (messages ?? []).filter((m) => filter === "all" || m.status === filter), [messages, filter]);

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
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-8">
        <AdminNav />
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">Support</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Messages from the Contact page. {messages ? `${openCount} open.` : ""} Replies are emailed to the customer.
        </p>
        <div className="mt-5 flex gap-1.5">
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
        {error && (
          <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>
        )}
        <div className="mt-5 space-y-4">
          {messages && !visible.length && <p className="text-sm text-slate-500 dark:text-slate-400">Nothing here.</p>}
          {visible.map((m) => (
            <SupportThread
              key={m.id}
              message={m}
              getIdToken={getIdToken}
              showUserLink
              onChange={(next) => setMessages((all) => (all ?? []).map((x) => (x.id === next.id ? next : x)))}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
