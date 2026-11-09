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

const reorderPreviewRows = [
  { label: "Bambu Lab Yellow PLA", detail: "~0.25 rolls (250 g)", status: "reorder" as const },
  { label: "eSun Sky Blue PETG", detail: "~1.00 rolls (1000 g)", status: "warn" as const },
  { label: "Bambu Lab Red PLA", detail: "~1.00 rolls (1000 g)", status: "warn" as const },
];

const rollCardPreviews = [
  { color: "Sky Blue", meta: "eSun · PETG", stock: "1000 g on hand", price: "$12.99 paid", status: "warn" as const },
  { color: "Yellow", meta: "Bambu Lab · PLA", stock: "250 g on hand", price: "$12.99 paid", status: "reorder" as const },
];

const projectPreviewCards = [
  {
    name: "Hex planter batch",
    status: "Active",
    statusClass: "bg-blue-100 text-blue-700",
    colors: ["Sky Blue PETG", "Yellow PLA — order now"],
    flagged: true,
    thumb: "image" as const,
  },
  {
    name: "Keychain samples",
    status: "Archived",
    statusClass: "bg-emerald-100 text-emerald-700",
    colors: ["Red PLA — 40g"],
    flagged: false,
    thumb: "model" as const,
  },
];

function CubeIconPreview() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M10 2.5 17 6.5v7L10 17.5 3 13.5v-7L10 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M3 6.5 10 10.5l7-4M10 10.5v7" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function ImageIconPreview() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="7.25" cy="8" r="1.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 13.5 7.5 10l2.5 2.3 2.5-2.8 4 3.8" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function MiniProjects() {
  return (
    <div className={`${styles.dashboard} relative w-full`}>
      <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase">Projects</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">Active &amp; queued</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />1 needs reorder
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4">
        {projectPreviewCards.map((project) => (
          <div
            key={project.name}
            className={`rounded-2xl border bg-white p-3 ${project.flagged ? "border-rose-300" : "border-slate-200"}`}
          >
            <div className="flex h-14 w-full items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              {project.thumb === "image" ? <ImageIconPreview /> : <CubeIconPreview />}
            </div>
            <div className="mt-2 flex items-start justify-between gap-1">
              <p className="text-xs font-semibold text-slate-900">{project.name}</p>
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${project.statusClass}`}>
                {project.status}
              </span>
            </div>
            <ul className="mt-1.5 space-y-0.5 text-[9px] text-slate-500">
              {project.colors.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniDashboard() {
  return (
    <div className={`${styles.dashboard} relative w-full`}>
      <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase">Filament rolls</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">Reorder report</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
          <span className={`${styles.liveDot} h-1.5 w-1.5 rounded-full bg-emerald-500`} />
          All synced
        </div>
      </div>

      <div className="space-y-1.5 p-4">
        {reorderPreviewRows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-xs"
          >
            <span className="text-slate-700">
              {row.label}
              <span className="ml-2 text-[10px] text-slate-400">{row.detail}</span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                row.status === "reorder" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {row.status === "reorder" ? "Reorder now" : "Low — order soon"}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pb-4">
        {rollCardPreviews.map((roll) => (
          <div
            key={roll.color}
            className={`rounded-2xl border bg-white p-3 ${
              roll.status === "reorder" ? "border-rose-300" : "border-amber-300"
            }`}
          >
            <p className="text-xs font-semibold text-slate-900">{roll.color}</p>
            <p className="text-[10px] text-slate-500">{roll.meta}</p>
            <span
              className={`mt-2 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                roll.status === "reorder" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {roll.status === "reorder" ? "Order soon" : "Last roll"}
            </span>
            <div className="mt-2 flex items-center justify-between text-[9px] text-slate-500">
              <span>{roll.stock}</span>
              <span>{roll.price}</span>
            </div>
          </div>
        ))}
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

        <div className="relative z-10 mt-10 hidden gap-4 lg:grid lg:grid-cols-1 xl:grid-cols-2">
          <MiniDashboard />
          <MiniProjects />
        </div>
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
