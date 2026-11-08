"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
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

  const name = user.displayName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";

  return (
    <main className="flex min-h-svh flex-1 flex-col bg-[#f5f8fc] dark:bg-[#05080e]">
      <Header />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:px-10">
        <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-400">Your workshop</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl dark:text-white">
          Welcome back, {name}.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          This is your landing spot after signing in. Rolls, estimates, and projects will live here as they ship.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Estimator", href: null },
            { label: "Inventory", href: "/inventory" },
            { label: "Projects", href: null },
          ].map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-400/40"
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</p>
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">Open →</p>
              </Link>
            ) : (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Coming soon</p>
              </div>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={() => signOut()}
          className="mt-10 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
