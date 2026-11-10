"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/admin/AdminNav";
import { AuditList } from "@/components/admin/AuditList";
import type { AuditEntry } from "@/lib/account-status";
import { fetchAuditLog } from "@/lib/admin-api";

export default function AdminActivityPage() {
  const { user, loading, isAdmin, getIdToken } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.replace(user ? "/dashboard" : "/");
  }, [loading, user, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    fetchAuditLog(getIdToken)
      .then((next) => active && setEntries(next))
      .catch((err: Error) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [isAdmin, getIdToken]);

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
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">Activity log</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Every admin action: who did it, to which account, and when. Latest 300.</p>
        {error && (
          <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>
        )}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-2 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          {entries ? <AuditList entries={entries} showTarget /> : !error && <p className="py-3 text-sm text-slate-500">Loading…</p>}
        </div>
      </div>
    </main>
  );
}
