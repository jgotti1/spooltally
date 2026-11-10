import type { Metadata } from "next";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoginForm } from "@/components/LoginForm";
import { ScreenshotShowcase } from "@/components/ScreenshotShowcase";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Sign in | SpoolTally",
  description: "Sign in to track filament, price prints, and manage projects.",
};

const benefits = [
  { value: "Accurate", label: "job pricing" },
  { value: "Real-time", label: "roll tracking" },
  { value: "Confident", label: "reorder planning" },
  { value: "On-schedule", label: "printer upkeep" },
];

function CheckIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4.5 10.5 3.2 3.2 7.8-8" /></svg>;
}

export default function LoginPage() {
  return (
    <main className={`${styles.shell} min-h-svh lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(480px,.92fr)]`}>
      <section className={`${styles.brandPanel} relative overflow-hidden px-6 pb-12 pt-6 text-white sm:px-10 lg:flex lg:min-h-svh lg:flex-col lg:px-12 lg:py-6 xl:px-16`}>
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

        <div className="relative z-10 mx-auto mt-8 w-full max-w-2xl lg:mt-6">
          <p className="mb-3 flex items-center gap-3 text-xs font-bold tracking-[0.2em] text-blue-300 uppercase">
            <span className="h-px w-8 bg-blue-400" />
            Your workshop, finally in sync
          </p>
          <h1 className="max-w-[720px] text-[clamp(2.1rem,3.4vw,3.4rem)] leading-[1] font-semibold tracking-[-0.055em] text-balance">
            Track every roll.
            <br />
            <span className={styles.gradientText}>Price every project.</span>
            <br />
            Keep every printer maintained.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
            Track every filament roll, see how each project uses it, and price the job with confidence—plus
            maintenance alerts that keep every printer on schedule.
          </p>

          <div className="mt-5 grid max-w-xl grid-cols-4 gap-4 border-y border-white/10 py-3">
            {benefits.map((benefit) => (
              <div key={benefit.value}>
                <p className="text-sm font-semibold text-white">{benefit.value}</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-400">{benefit.label}</p>
              </div>
            ))}
          </div>
        </div>

        <ScreenshotShowcase className="relative z-10 mt-6 hidden min-h-[400px] flex-1 lg:flex" />
      </section>

      <section className={`${styles.authPanel} relative flex items-center justify-center px-5 py-10 sm:px-10 lg:min-h-svh lg:px-12`}>
        <div className={`${styles.authGlow} pointer-events-none absolute inset-0`} aria-hidden="true" />
        <ThemeToggle className="fixed top-5 right-5 z-50 lg:top-6 lg:right-6" />
        <div className="relative z-10 w-full max-w-[440px]">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><CheckIcon /></span>
              14-day free trial
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">No credit card required</p>
          </div>

          <LoginForm />

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-emerald-500" />Secure sign-in</span>
            <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300">Terms</a>
            <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300">Privacy</a>
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
            &copy; 2026 margotticode.com
          </p>
        </div>
      </section>
    </main>
  );
}
