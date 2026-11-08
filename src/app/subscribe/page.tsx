"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";

const plans = [
  {
    id: "monthly",
    name: "Monthly",
    price: "$7.99",
    cadence: "/ month",
    billedAs: "Billed monthly",
    highlight: false,
  },
  {
    id: "quarterly",
    name: "3 Months",
    price: "$20.00",
    cadence: "/ 3 months",
    billedAs: "Billed every 3 months — save ~17%",
    highlight: true,
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "$60.00",
    cadence: "/ year",
    billedAs: "Billed annually — save ~37%",
    highlight: false,
  },
];

export default function SubscribePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

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
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-14 sm:px-10">
        <BackLink />
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-400">
            Your trial has ended
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl dark:text-white">
            Pick a plan to keep going
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Your rolls, estimates, and projects are saved and waiting — they&rsquo;re locked, not deleted. Choose a plan
            below to pick up right where you left off.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${
                plan.highlight
                  ? "border-blue-500 bg-white shadow-lg shadow-blue-900/10 dark:border-blue-400 dark:bg-white/[0.04]"
                  : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold tracking-wide text-white uppercase dark:bg-blue-500">
                  Most popular
                </span>
              )}
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{plan.name}</p>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                  {plan.price}
                </span>
                <span className="text-sm text-slate-400 dark:text-slate-500">{plan.cadence}</span>
              </p>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{plan.billedAs}</p>

              <button
                type="button"
                disabled
                title="Checkout isn't wired up yet"
                className={`mt-6 flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                  plan.highlight
                    ? "bg-slate-950 text-white disabled:opacity-70"
                    : "border border-slate-200 bg-white text-slate-700 disabled:opacity-60 dark:border-white/10 dark:bg-transparent dark:text-slate-200"
                }`}
              >
                Choose {plan.name}
              </button>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-slate-200 bg-white/60 p-5 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            Plans auto-renew at the end of each billing period unless canceled — cancel anytime, no questions asked.
            Payments are processed securely by Stripe; SpoolTally never sees or stores your card details.
          </p>
        </div>
      </div>
    </main>
  );
}
