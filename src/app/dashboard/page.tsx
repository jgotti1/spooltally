"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";

function SpoolIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 9.5v1M14.5 12h-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CalculatorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 7.5h8M8 12h1.5M11.5 12H13M14.5 12H16M8 15.5h1.5M11.5 15.5H13M14.5 15.5H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <rect x="6" y="4.5" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 4.5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 11.5h6M9 15h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const sections = [
  { label: "Estimator", href: null, description: "Price a job from grams or an uploaded file.", icon: CalculatorIcon },
  { label: "Inventory", href: "/inventory", description: "Track rolls, levels, and what to reorder.", icon: SpoolIcon },
  { label: "Projects", href: null, description: "Turn saved estimates into tracked jobs.", icon: ClipboardIcon },
];

export default function DashboardPage() {
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

  const name = user.displayName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";

  return (
    <main className="flex min-h-svh flex-1 flex-col bg-[#f5f8fc] dark:bg-[#05080e]">
      <Header />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:px-10">
        <div
          className="relative overflow-hidden rounded-3xl px-6 py-10 text-white shadow-lg sm:px-10 sm:py-12"
          style={{
            background:
              "radial-gradient(circle at 16% 20%, rgba(21, 137, 255, 0.22), transparent 32%), radial-gradient(circle at 88% 82%, rgba(20, 223, 152, 0.14), transparent 32%), linear-gradient(145deg, #061725 0%, #0b2235 52%, #071a29 100%)",
          }}
        >
          <p className="text-xs font-bold tracking-[0.16em] text-blue-300 uppercase">Your workshop</p>
          <h1 className="mt-2 max-w-xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Welcome back, {name}.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
            Rolls, estimates, and projects live here as they ship — inventory is up first.
          </p>
          <Link
            href="/inventory/new"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100"
          >
            <PlusIcon />
            Add a roll
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {sections.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <Icon />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400 dark:text-slate-500">{item.description}</p>
                <p className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {item.href ? "Open →" : "Coming soon"}
                </p>
              </>
            );
            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-400/40"
              >
                {content}
              </Link>
            ) : (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 opacity-80 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
              >
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
