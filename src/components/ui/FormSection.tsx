import type { ReactNode } from "react";

/**
 * A titled group of fields inside a form card: a small icon chip, the section name, an optional hint, and a hairline
 * that runs to the edge. Breaks a long form into scannable steps instead of one undifferentiated stack.
 */
export function FormSection({ title, hint, icon, children }: { title: string; hint?: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shadow-[inset_0_0_0_1px_rgba(29,111,242,0.18)] dark:bg-blue-500/15 dark:text-blue-300 dark:shadow-[inset_0_0_0_1px_rgba(96,165,250,0.25)]">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[15px] leading-tight font-semibold tracking-[-0.01em] text-slate-950 dark:text-white">{title}</h2>
          {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
        </div>
        <span aria-hidden="true" className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export const sectionIconProps = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "h-4 w-4",
  "aria-hidden": true,
} as const;
