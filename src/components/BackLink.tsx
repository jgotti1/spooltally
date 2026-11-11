import Link from "next/link";

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M12 4.5 6 10l6 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Explicit way back to the dashboard, so pages don't rely on the browser back button. */
export function BackLink({ href = "/dashboard", label = "Back to dashboard" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      className="group mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1px_var(--st-ring)] transition-transform duration-150 group-hover:-translate-x-0.5 dark:bg-white/[0.06]">
        <ArrowLeftIcon />
      </span>
      {label}
    </Link>
  );
}
