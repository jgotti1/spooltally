"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { useAccountStatus } from "@/lib/use-account";
import { planBadge } from "@/lib/account-status";

export default function SubscriptionInfoPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const badge = planBadge(useAccountStatus().info);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

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
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-14 sm:px-10">
        <BackLink />
        <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-400">Account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
          Subscription information
        </h1>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Current plan</p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                badge.warn
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              }`}
            >
              {badge.label}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {badge.detail}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Link
              href="/subscribe"
              className="flex h-11 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Subscribe
            </Link>
            <button
              type="button"
              disabled
              title="No active subscription to renew yet"
              className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-400 disabled:cursor-not-allowed dark:border-white/10 dark:bg-transparent dark:text-slate-500"
            >
              Renew
            </button>
            <button
              type="button"
              disabled
              title="No active subscription to update yet"
              className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-400 disabled:cursor-not-allowed dark:border-white/10 dark:bg-transparent dark:text-slate-500"
            >
              Update plan
            </button>
          </div>
        </div>

        <p className="mt-6 text-xs leading-5 text-slate-400 dark:text-slate-500">
          Subscriptions auto-renew until canceled — cancel anytime. Payments are handled securely by Stripe;
          SpoolTally never sees or stores your card details.
        </p>
      </div>
    </main>
  );
}
