import type { Metadata } from "next";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoginForm } from "@/components/LoginForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Sign in | SpoolTally",
  description: "Sign in to track filament, price prints, and manage projects.",
};

const benefits = [
  { value: "Accurate", label: "job pricing" },
  { value: "Real-time", label: "roll tracking" },
  { value: "Confident", label: "reorder planning" },
];

function CheckIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4.5 10.5 3.2 3.2 7.8-8" /></svg>;
}

function MiniDashboard() {
  return (
    <div className={`${styles.dashboard} relative mx-auto w-full max-w-[520px]`}>
      <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase">Production overview</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">Friday, Nov 7</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
          <span className={`${styles.liveDot} h-1.5 w-1.5 rounded-full bg-emerald-500`} />
          All synced
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-[1.35fr_.9fr]">
        <div className="rounded-2xl bg-slate-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Hex planter · 6 units</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">$18.40</p>
              <p className="mt-1 text-[11px] text-slate-400">suggested price / unit</p>
            </div>
            <span className="rounded-lg bg-blue-500/15 px-2 py-1 text-[10px] font-semibold text-blue-300">+64% margin</span>
          </div>
          <div className="mt-5">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <span className="h-full bg-slate-500" style={{ width: "36%" }} />
              <span className="h-full bg-blue-400" style={{ width: "64%" }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
              <span>Est. cost $6.60</span>
              <span>Suggested $18.40</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Filament inventory</p>
            <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              1 low
            </p>
          </div>
          <div className="mt-4 flex items-end justify-between gap-2">
            {[
              { color: "#1688ff", label: "1/4 left", fill: "25%", flag: "Reorder" },
              { color: "#17a563", label: "6 rolls", fill: "100%" },
              { color: "#0f2940", label: "2 rolls", fill: "100%" },
            ].map((roll) => (
              <div key={roll.color} className="flex flex-1 flex-col items-center gap-1.5">
                {roll.flag ? (
                  <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-amber-700 uppercase">{roll.flag}</span>
                ) : (
                  <span className="h-[15px]" aria-hidden="true" />
                )}
                <div className="relative h-16 w-5 overflow-hidden rounded-full bg-slate-100">
                  <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: roll.fill, background: roll.color }} />
                </div>
                <span className="text-[9px] font-semibold text-slate-500">{roll.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className={`${styles.shell} min-h-svh lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(480px,.92fr)]`}>
      <section className={`${styles.brandPanel} relative overflow-hidden px-6 pb-12 pt-6 text-white sm:px-10 lg:flex lg:min-h-svh lg:flex-col lg:px-12 lg:py-10 xl:px-16`}>
        <div className={styles.gridPattern} aria-hidden="true" />
        <div className={`${styles.orb} ${styles.orbOne}`} aria-hidden="true" />
        <div className={`${styles.orb} ${styles.orbTwo}`} aria-hidden="true" />

        <header className="relative z-10 flex items-center justify-between">
          <a href="#" className="flex items-center gap-4 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" aria-label="SpoolTally home">
            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-950/20 ring-1 ring-white/70 sm:h-20 sm:w-20">
              <LogoMark className="h-full w-full object-cover" />
            </span>
            <span className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Spool<span className="text-blue-400">Tally</span></span>
          </a>
          <span className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3.5 py-2 text-xs font-medium text-slate-200 backdrop-blur-sm sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Built for 3D print sellers
          </span>
        </header>

        <div className="relative z-10 mx-auto mt-14 w-full max-w-2xl lg:my-auto lg:py-10">
          <p className="mb-5 flex items-center gap-3 text-xs font-bold tracking-[0.2em] text-blue-300 uppercase">
            <span className="h-px w-8 bg-blue-400" />
            Your workshop, finally in sync
          </p>
          <h1 className="max-w-[720px] text-[clamp(2.65rem,4.6vw,4.85rem)] leading-[.95] font-semibold tracking-[-0.065em] text-balance">
            Track every roll.
            <br />
            <span className={styles.gradientText}>Price every project.</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            Turn filament, print time, and platform fees into prices you can trust—then keep every roll and project moving.
          </p>

          <div className="mt-8 grid max-w-xl grid-cols-3 gap-4 border-y border-white/10 py-5">
            {benefits.map((benefit) => (
              <div key={benefit.value}>
                <p className="text-sm font-semibold text-white sm:text-base">{benefit.value}</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-400 sm:text-xs">{benefit.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-10 hidden lg:block"><MiniDashboard /></div>
      </section>

      <section className={`${styles.authPanel} relative flex items-center justify-center px-5 py-10 sm:px-10 lg:min-h-svh lg:px-12`}>
        <div className={`${styles.authGlow} pointer-events-none absolute inset-0`} aria-hidden="true" />
        <ThemeToggle className="fixed top-5 right-5 z-50 lg:top-6 lg:right-6" />
        <div className="relative z-10 w-full max-w-[440px]">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><CheckIcon /></span>
              7-day free trial
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">No credit card required</p>
          </div>

          <LoginForm />

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-emerald-500" />Secure sign-in</span>
            <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300">Terms</a>
            <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300">Privacy</a>
          </div>
        </div>
      </section>
    </main>
  );
}
