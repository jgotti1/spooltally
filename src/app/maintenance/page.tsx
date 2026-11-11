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
      <main className="flex min-h-svh flex-1 items-center justify-center st-page">
        <p className="st-loading">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-1 flex-col st-page">
      <Header />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:px-10">
        <BackLink />
        <div className="mb-8 flex items-start gap-4">
          <span className="st-badge st-badge-amber mt-1">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="M12.5 3.5a3.5 3.5 0 0 0-3.2 4.8L3.5 14.1a1.6 1.6 0 0 0 2.4 2.4l5.8-5.8a3.5 3.5 0 0 0 4.8-3.2l-2.2 2.2-2-.5-.5-2z" />
            </svg>
          </span>
          <div>
            <p className="st-eyebrow">Printer care</p>
            <h1 className="st-title mt-1">Printer maintenance</h1>
            <p className="st-lede mt-2 max-w-2xl">
              Name your printers, record what was done, and schedule the next maintenance reminder.
            </p>
          </div>
        </div>
        <PrinterMaintenance ownerId={user.uid} />
      </div>
    </main>
  );
}
