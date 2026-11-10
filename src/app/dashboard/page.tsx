"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { subscribeToRolls, type Roll } from "@/lib/rolls";
import { getInventorySettings, DEFAULT_INVENTORY_SETTINGS, type InventorySettings } from "@/lib/inventory-settings";
import { groupLowRolls } from "@/lib/inventory-status";
import { subscribeToProjects, type Project } from "@/lib/projects";
import {
  formatMaintenanceDate,
  isMaintenanceSoon,
  maintenanceDueStatus,
  MAINTENANCE_UPCOMING_WINDOW_DAYS,
  subscribeToPrinters,
  type Printer,
} from "@/lib/printer-maintenance";

function SpoolIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 9.5v1M14.5 12h-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <rect x="6" y="4.5" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 4.5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 11.5h6M9 15h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path
        d="M14.5 6.5a4.5 4.5 0 0 0-5.8 5.8L3.5 17.5a2.1 2.1 0 0 0 3 3l5.2-5.2a4.5 4.5 0 0 0 5.8-5.8l-2.7 2.7-3-3 2.7-2.7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const sections = [
  { label: "Inventory", href: "/inventory", description: "Track rolls, levels, and what to reorder.", icon: SpoolIcon },
  { label: "Projects", href: "/projects", description: "Colors, pricing, and tracking in one place.", icon: ClipboardIcon },
  { label: "Maintenance", href: "/maintenance", description: "Log printer service and see what is due.", icon: WrenchIcon },
];

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [settings, setSettings] = useState<InventorySettings>(DEFAULT_INVENTORY_SETTINGS);
  const [projects, setProjects] = useState<Project[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getInventorySettings(user.uid).then((next) => {
      if (active) setSettings(next);
    });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToRolls(user.uid, setRolls);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToProjects(user.uid, setProjects);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToPrinters(user.uid, setPrinters);
  }, [user]);

  const totalGrams = useMemo(() => rolls.reduce((sum, r) => sum + r.remainingGrams, 0), [rolls]);
  const reorderCount = useMemo(() => groupLowRolls(rolls, settings).length, [rolls, settings]);
  const activeProjectCount = useMemo(() => projects.filter((p) => p.status === "Active").length, [projects]);
  const projectsNeedingReorderCount = useMemo(() => {
    const rollsById = new Map(rolls.map((r) => [r.id, r]));
    return projects.filter((p) =>
      p.colorsNeeded.some((need) => need.rollIds.some((id) => rollsById.get(id)?.remainingGrams === 0)),
    ).length;
  }, [projects, rolls]);
  const maintenanceDuePrinters = useMemo(
    () => printers.filter((printer) => isMaintenanceSoon(maintenanceDueStatus(printer.nextDueDate))),
    [printers],
  );
  const maintenanceUrgentPrinters = useMemo(
    () =>
      printers.filter((printer) => {
        const status = maintenanceDueStatus(printer.nextDueDate);
        return status === "overdue" || status === "due";
      }),
    [printers],
  );
  function printerDueLabel(printer: Printer): string {
    return printer.nextDueDate ? `${printer.name} (${formatMaintenanceDate(printer.nextDueDate)})` : printer.name;
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-svh flex-1 items-center justify-center bg-[#f5f8fc] dark:bg-[#05080e]">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  const name = user.displayName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";

  return (
    <main className="flex min-h-svh flex-1 flex-col bg-[#f5f8fc] dark:bg-[#05080e]">
      <Header />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:px-10">
        <div
          className="relative overflow-hidden rounded-3xl px-6 py-10 text-white shadow-lg sm:px-10 sm:py-12"
          style={{
            background:
              "radial-gradient(circle at 16% 20%, rgba(21, 137, 255, 0.22), transparent 32%), radial-gradient(circle at 88% 82%, rgba(20, 223, 152, 0.14), transparent 32%), linear-gradient(145deg, #061725 0%, #0b2235 52%, #071a29 100%)",
          }}
        >
          <p className="text-xs font-bold tracking-[0.16em] text-blue-300 uppercase">Your workshop</p>
          <h1 className="mt-2 max-w-xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Welcome back, {name}.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
            Track your filament and price your prints — inventory is up first.
          </p>
          <Link
            href="/inventory/new"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100"
          >
            <PlusIcon />
            Add a roll
          </Link>
        </div>

        {maintenanceDuePrinters.length > 0 &&
          (maintenanceUrgentPrinters.length > 0 ? (
            <Link
              href="/maintenance"
              className="mt-6 flex items-start justify-between gap-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 transition-colors hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:hover:bg-rose-500/15"
            >
              <div>
                <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">Printer maintenance is overdue</p>
                <ul className="mt-1.5 space-y-0.5 text-xs leading-5 text-rose-700 dark:text-rose-300">
                  {maintenanceUrgentPrinters.map((printer) => (
                    <li key={printer.id}>{printerDueLabel(printer)}</li>
                  ))}
                </ul>
              </div>
              <span className="shrink-0 text-xs font-semibold text-rose-700 dark:text-rose-300">View →</span>
            </Link>
          ) : (
            <Link
              href="/maintenance"
              className="mt-6 flex items-start justify-between gap-4 rounded-2xl border border-blue-300 bg-blue-50 p-4 transition-colors hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/10 dark:hover:bg-blue-500/15"
            >
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                  Printer maintenance coming up within {MAINTENANCE_UPCOMING_WINDOW_DAYS} days
                </p>
                <ul className="mt-1.5 space-y-0.5 text-xs leading-5 text-blue-700 dark:text-blue-300">
                  {maintenanceDuePrinters.map((printer) => (
                    <li key={printer.id}>{printerDueLabel(printer)}</li>
                  ))}
                </ul>
              </div>
              <span className="shrink-0 text-xs font-semibold text-blue-700 dark:text-blue-300">View →</span>
            </Link>
          ))}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {sections.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <Icon />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400 dark:text-slate-500">{item.description}</p>
                <p className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {item.href ? "Open →" : "Coming soon"}
                </p>
              </>
            );
            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-400/40"
              >
                {content}
              </Link>
            ) : (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 opacity-80 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
              >
                {content}
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">At a glance</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-2xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">{rolls.length}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Rolls tracked</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                {(totalGrams / 1000).toFixed(1)} kg
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Filament on hand</p>
            </div>
            <div>
              <p
                className={`text-2xl font-semibold tracking-[-0.02em] ${
                  reorderCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-950 dark:text-white"
                }`}
              >
                {reorderCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Rolls needing reorder</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                {activeProjectCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Active projects</p>
            </div>
            <div>
              <p
                className={`text-2xl font-semibold tracking-[-0.02em] ${
                  projectsNeedingReorderCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-950 dark:text-white"
                }`}
              >
                {projectsNeedingReorderCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Projects missing filament</p>
            </div>
            <div>
              <p
                className={`text-2xl font-semibold tracking-[-0.02em] ${
                  maintenanceUrgentPrinters.length > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : maintenanceDuePrinters.length > 0
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-slate-950 dark:text-white"
                }`}
              >
                {maintenanceDuePrinters.length}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Printers needing service within {MAINTENANCE_UPCOMING_WINDOW_DAYS} days
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            <Link
              href="/inventory"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              View inventory →
            </Link>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              View projects →
            </Link>
            <Link
              href="/maintenance"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              View maintenance →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
