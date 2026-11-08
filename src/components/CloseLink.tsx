"use client";

import { useRouter } from "next/navigation";

function XIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

type CloseLinkProps = {
  href: string;
  /** When true, confirms before leaving instead of navigating straight away. */
  dirty?: boolean;
};

/** Top-right close button for forms, for leaving without saving. Confirms first if there are unsaved changes. */
export function CloseLink({ href, dirty }: CloseLinkProps) {
  const router = useRouter();

  function handleClick() {
    if (dirty && !window.confirm("Close without saving changes?")) return;
    router.push(href);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Close"
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
    >
      <XIcon />
      Close
    </button>
  );
}
