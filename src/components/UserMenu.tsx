"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

/** Account dropdown: profile info pulled from the signed-in provider, plus billing placeholders. */
export function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!user) return null;

  const name = user.displayName ?? user.email ?? "Account";
  const email = user.email ?? "";
  const initial = name.charAt(0).toUpperCase();
  const provider = user.providerData[0]?.providerId === "google.com" ? "Google account" : "Email & password";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-xs font-semibold text-white ring-2 ring-transparent transition-shadow hover:ring-slate-200 dark:bg-white/10 dark:hover:ring-white/15"
      >
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-[#0d131c] dark:shadow-black/40">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 dark:border-white/10">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-sm font-semibold text-white dark:bg-white/10">
              {user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{email}</p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">{provider}</p>
            </div>
          </div>

          <div className="space-y-3 px-4 py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Plan</span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                Free trial
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Billing</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">Cancel anytime</span>
            </div>
            <Link
              href="/account/subscription"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.06]"
            >
              Subscription information
            </Link>
          </div>

          <div className="border-t border-slate-100 px-4 py-3 dark:border-white/10">
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
            >
              Contact support
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
