"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";

function icon(path: ReactNode) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      {path}
    </svg>
  );
}

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: icon(
      <>
        <rect x="3" y="3" width="6" height="7" rx="1.5" />
        <rect x="11" y="3" width="6" height="4" rx="1.5" />
        <rect x="3" y="12" width="6" height="5" rx="1.5" />
        <rect x="11" y="9" width="6" height="8" rx="1.5" />
      </>,
    ),
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: icon(
      <>
        <circle cx="10" cy="10" r="7" />
        <circle cx="10" cy="10" r="2.5" />
      </>,
    ),
  },
  {
    label: "Projects",
    href: "/projects",
    icon: icon(
      <>
        <rect x="4" y="3.5" width="12" height="14" rx="2" />
        <path d="M7.5 3.5V2.5h5v1M7.5 9h5M7.5 12.5h5" />
      </>,
    ),
  },
  {
    label: "Maintenance",
    href: "/maintenance",
    icon: icon(<path d="M12.5 3.5a3.5 3.5 0 0 0-3.2 4.8L3.5 14.1a1.6 1.6 0 0 0 2.4 2.4l5.8-5.8a3.5 3.5 0 0 0 4.8-3.2l-2.2 2.2-2-.5-.5-2z" />),
  },
];

const adminNavItem = {
  label: "Admin",
  href: "/admin",
  icon: icon(<path d="M10 2.5 4 5v4.5c0 3.6 2.4 6.4 6 8 3.6-1.6 6-4.4 6-8V5l-6-2.5zM7.5 10l2 2 3.5-4" />),
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Segmented nav: the active section is a raised white pill on a tinted track; the rest sit flat until hovered. */
function navLinkClass(active: boolean) {
  return [
    "relative flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-[color,background-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
    active
      ? "bg-white text-slate-950 shadow-[0_1px_2px_rgba(16,24,40,0.08),0_4px_12px_-6px_rgba(16,24,40,0.2)] dark:bg-white/[0.14] dark:text-white dark:shadow-none [&_svg]:text-blue-600 dark:[&_svg]:text-blue-300"
      : "text-slate-500 hover:bg-white/60 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white",
  ].join(" ");
}

/** Shared top nav for authenticated app pages. The current section is highlighted so it's always clear where you are. */
export function Header() {
  const pathname = usePathname();
  // Convenience only: the page, the API routes and Firestore rules each check the admin claim again.
  const { isAdmin } = useAuth();
  const items = isAdmin ? [...navItems, adminNavItem] : navItems;

  return (
    <header className="sticky top-0 z-30 bg-white/80 shadow-[inset_0_-1px_0_var(--st-ring)] backdrop-blur-xl dark:bg-[#070b12]/80">
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr]">
        <Link href="/dashboard" aria-label="SpoolTally home" className="group flex shrink-0 items-center gap-2.5 justify-self-start">
          <LogoMark className="h-9 w-9 rounded-[10px] shadow-sm ring-1 ring-slate-900/[0.06] transition-transform duration-200 group-hover:-rotate-6 dark:ring-white/10" />
          <span className="font-display text-[1.45rem] leading-none font-bold tracking-[-0.03em] text-slate-950 dark:text-white">
            Spool<span className="text-blue-600 dark:text-blue-400">Tally</span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 rounded-xl bg-slate-100/80 p-1 ring-1 ring-slate-900/[0.05] md:flex dark:bg-white/[0.04] dark:ring-white/[0.07]">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={navLinkClass(active)}>
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2.5 justify-self-end">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>

      {/* Phones: the same links as a scrollable row, since the main nav is hidden below md. */}
      <nav aria-label="Main" className="flex overflow-x-auto px-3 pb-2 md:hidden">
        <div className="mx-auto flex gap-1 rounded-xl bg-slate-100/80 p-1 ring-1 ring-slate-900/[0.05] dark:bg-white/[0.04] dark:ring-white/[0.07]">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={navLinkClass(active)}>
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
