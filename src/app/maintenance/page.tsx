"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { Header } from "@/components/Header";
import { PrinterMaintenance } from "@/components/PrinterMaintenance";
import { useAuth } from "@/lib/auth-context";

export default function MaintenancePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <main className="flex min-h-svh flex-1 items-center justify-center bg-[#f5f8fc] dark:bg-[#05080e]">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-1 flex-col bg-[#f5f8fc] dark:bg-[#05080e]">
      <Header />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:px-10">
        <BackLink />
        <div className="mb-8">
          <p className="text-xs font-bold tracking-[0.14em] text-blue-600 uppercase dark:text-blue-400">
            Printer care
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
            Printer maintenance
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Name your printers, record what was done, and schedule the next maintenance reminder.
          </p>
        </div>
        <PrinterMaintenance ownerId={user.uid} />
      </div>
    </main>
  );
}
