"use client";

import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";

const navItems = ["Estimator", "Inventory", "Projects"];

/** Shared top nav for authenticated app pages. */
export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-white/10 dark:bg-[#05080e]">
      <Link href="/dashboard" aria-label="SpoolTally home" className="flex items-center gap-3">
        <LogoMark className="h-11 w-11 rounded-xl shadow-sm" />
        <span className="flex flex-col leading-tight">
          <span className="text-2xl font-bold tracking-[-0.03em] text-slate-950 sm:text-3xl dark:text-white">
            Spool<span className="text-blue-600 dark:text-blue-400">Tally</span>
          </span>
          <span className="hidden text-[11px] font-medium text-slate-400 sm:block dark:text-slate-500">
            Track your filament. Price your prints. Keep tabs on projects.
          </span>
        </span>
      </Link>
      <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex dark:text-slate-400">
        {navItems.map((item) => (
          <span key={item} className="cursor-default hover:text-slate-900 dark:hover:text-white">
            {item}
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
