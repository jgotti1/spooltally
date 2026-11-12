"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Rows per page for long lists. The list itself scrolls inside its own box (see LIST_SCROLL_CLASS), so the browser page stays put. */
export const PAGE_SIZE = 25;

/**
 * Wraps a long list so it scrolls inside its own box instead of stretching the browser page, and jumps back to the top
 * whenever the page number changes.
 */
export function ListScroll({ page, children, className = "" }: { page: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [page]);
  return (
    <div ref={ref} className={`max-h-[60vh] overflow-y-auto overscroll-contain ${className}`}>
      {children}
    </div>
  );
}

/**
 * Splits a long list into pages. `resetKey` is anything that should send the reader back to page 1 when it changes
 * (the active filter, the search text). Wrap the rows in <ListScroll page={pager.page}> and spread `pager` onto <Pager />.
 */
export function usePaged<T>(items: T[], resetKey: string = "", pageSize: number = PAGE_SIZE) {
  const [page, setPageState] = useState(1);
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setPageState(1);
  }
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const setPage = setPageState;
  return {
    pageItems: items.slice(start, start + pageSize),
    /** Spread onto <Pager />. */
    pager: {
      page: current,
      pageCount,
      setPage,
      from: items.length ? start + 1 : 0,
      to: Math.min(start + pageSize, items.length),
      total: items.length,
    },
  };
}

const buttonClass =
  "h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const idleClass = "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10";
const activeClass = "bg-slate-950 text-white dark:bg-white dark:text-slate-950";

/** "First ‹ 1 2 3 4 5 › Last" with a "Showing 26–50 of 312" count. Renders nothing extra when there is only one page. */
export function Pager({
  page,
  pageCount,
  setPage,
  from,
  to,
  total,
  noun = "entries",
  className = "",
}: {
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
  from: number;
  to: number;
  total: number;
  noun?: string;
  className?: string;
}) {
  if (total === 0) return null;
  // Up to five page numbers, centered on the current page.
  const first = Math.max(1, Math.min(page - 2, pageCount - 4));
  const numbers = Array.from({ length: Math.min(5, pageCount) }, (_, i) => first + i);
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 ${className}`}>
      <span>
        Showing {from}–{to} of {total} {noun}
      </span>
      {pageCount > 1 && (
        <nav aria-label="Pages" className="flex flex-wrap items-center gap-1">
          <button type="button" disabled={page === 1} onClick={() => setPage(1)} className={`${buttonClass} ${idleClass}`}>
            First
          </button>
          <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage(page - 1)} className={`${buttonClass} ${idleClass}`}>
            ‹
          </button>
          {numbers.map((n) => (
            <button
              key={n}
              type="button"
              aria-current={n === page ? "page" : undefined}
              onClick={() => setPage(n)}
              className={`${buttonClass} ${n === page ? activeClass : idleClass}`}
            >
              {n}
            </button>
          ))}
          <button type="button" aria-label="Next page" disabled={page === pageCount} onClick={() => setPage(page + 1)} className={`${buttonClass} ${idleClass}`}>
            ›
          </button>
          <button type="button" disabled={page === pageCount} onClick={() => setPage(pageCount)} className={`${buttonClass} ${idleClass}`}>
            Last
          </button>
        </nav>
      )}
    </div>
  );
}
