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
import { describeShortage, projectStock } from "@/lib/project-stock";
import { ProfilePrompt } from "@/components/ProfilePrompt";
import { HeroArt } from "@/components/ui/Art";
import { getShopSettings } from "@/lib/shop-settings";
import { costPerGram, isUsingDefaultRollCost } from "@/lib/estimator-pricing";
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

const money = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function DashboardPage() {
  const { user, loading, viewingAs } = useAuth();
  const router = useRouter();
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [settings, setSettings] = useState<InventorySettings>(DEFAULT_INVENTORY_SETTINGS);
  const [shopName, setShopName] = useState("");
  /** null until the settings doc has loaded, so the first-login prompt never flashes for returning users. */
  const [promptDone, setPromptDone] = useState<boolean | null>(null);
  const [nameOverride, setNameOverride] = useState("");
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
    getShopSettings(user.uid)
      .then((next) => {
        if (!active) return;
        setShopName(next.shopName);
        setPromptDone(next.profilePromptDone);
      })
      .catch(() => {});
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

  /** A full-roll entry can hold several identical spools (`quantity`), so count spools, not entries. */
  const spoolCount = useMemo(() => rolls.reduce((sum, r) => sum + Math.max(1, r.quantity || 1), 0), [rolls]);
  const totalGrams = useMemo(() => rolls.reduce((sum, r) => sum + r.remainingGrams, 0), [rolls]);
  /** What the filament on the shelf is worth at the price paid; rolls with no price use the $20 default. */
  const stockValue = useMemo(() => {
    let value = 0;
    let estimated = false;
    for (const roll of rolls) {
      value += roll.remainingGrams * costPerGram(roll);
      if (roll.remainingGrams > 0 && isUsingDefaultRollCost(roll)) estimated = true;
    }
    return { value, estimated };
  }, [rolls]);
  const lowGroups = useMemo(() => groupLowRolls(rolls, settings), [rolls, settings]);
  const activeProjects = useMemo(() => projects.filter((p) => p.status === "Active"), [projects]);
  /** Active projects whose colors may run short for one full batch, with what's missing. */
  const shortProjects = useMemo(
    () =>
      activeProjects
        .map((project) => ({ project, stock: projectStock(project, rolls) }))
        .filter(({ stock }) => stock.short),
    [activeProjects, rolls],
  );
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
      <main className="flex min-h-svh flex-1 items-center justify-center st-page">
        <p className="st-loading">Loading…</p>
      </main>
    );
  }

  const fullName = nameOverride || user.displayName || "";
  const name = fullName.split(" ")[0] || user.email?.split("@")[0] || "there";
  const needsName = !fullName;
  const needsShopName = !shopName;
  const showProfilePrompt = !viewingAs && promptDone === false && (needsName || needsShopName);
  const attentionCount = lowGroups.length + shortProjects.length + maintenanceDuePrinters.length;

  return (
    <main className="flex min-h-svh flex-1 flex-col st-page">
      <Header />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 sm:px-10 sm:py-10">
        {showProfilePrompt && (
          <ProfilePrompt
            user={user}
            needsName={needsName}
            needsShopName={needsShopName}
            onDone={(result) => {
              if (result.name) setNameOverride(result.name);
              if (result.shopName) setShopName(result.shopName);
              setPromptDone(true);
            }}
          />
        )}

        {/* Hero: the same deep-navy brand panel as sign-in, with the strand-and-rings art echoing the logo. */}
        <section
          className="st-rise relative overflow-hidden rounded-[28px] px-6 py-10 text-white shadow-[0_30px_60px_-30px_rgba(6,23,37,0.6)] sm:px-10 sm:py-12"
          style={{
            background:
              "radial-gradient(circle at 14% 18%, rgba(29, 111, 242, 0.28), transparent 34%), radial-gradient(circle at 90% 85%, rgba(20, 223, 152, 0.16), transparent 34%), linear-gradient(145deg, #061725 0%, #0b2235 52%, #071a29 100%)",
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.18] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)",
              backgroundSize: "52px 52px",
            }}
          />
          <HeroArt className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[62%] sm:block" />

          <div className="relative">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-blue-300 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.2)]" />
              {shopName || "Your workshop"}
            </p>
            <h1 className="mt-3 max-w-xl font-display text-[2.4rem] leading-[1.02] font-semibold tracking-[-0.03em] sm:text-5xl">
              Welcome back, {name}.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-6 text-slate-300">
              {attentionCount === 0
                ? "Stock, projects and printers are all in good shape."
                : `${attentionCount} thing${attentionCount === 1 ? "" : "s"} could use a look today.`}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/projects/new"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 shadow-[0_10px_24px_-12px_rgba(255,255,255,0.6)] transition-all hover:-translate-y-0.5 hover:bg-blue-50"
              >
                <PlusIcon />
                New project
              </Link>
              <Link
                href="/inventory/new"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/[0.08] px-4 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/[0.14]"
              >
                <PlusIcon />
                Add a roll
              </Link>
              <Link
                href="/maintenance"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/[0.08] px-4 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/[0.14]"
              >
                <WrenchIcon />
                Log maintenance
              </Link>
            </div>
          </div>
        </section>

        {(maintenanceDuePrinters.length > 0 || shortProjects.length > 0 || lowGroups.length > 0) && (
          <section className="mt-6" aria-label="Needs attention">
            <p className="st-eyebrow mb-3 text-slate-500 dark:text-slate-400">Needs attention</p>
            <div className="grid gap-3 lg:grid-cols-3">
              {maintenanceDuePrinters.length > 0 && (
                <Link
                  href="/maintenance"
                  className={`st-card st-card-hover st-accent flex items-start justify-between gap-4 p-4 pl-6 ${
                    maintenanceUrgentPrinters.length > 0 ? "st-accent-rose" : "st-accent-blue"
                  }`}
                >
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold ${
                        maintenanceUrgentPrinters.length > 0
                          ? "text-rose-700 dark:text-rose-300"
                          : "text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      {maintenanceUrgentPrinters.length > 0
                        ? "Printer maintenance is overdue"
                        : `Maintenance due within ${MAINTENANCE_UPCOMING_WINDOW_DAYS} days`}
                    </p>
                    <ul className="mt-1.5 space-y-0.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {(maintenanceUrgentPrinters.length > 0 ? maintenanceUrgentPrinters : maintenanceDuePrinters).map(
                        (printer) => (
                          <li key={printer.id}>{printerDueLabel(printer)}</li>
                        ),
                      )}
                    </ul>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">View →</span>
                </Link>
              )}

              {shortProjects.length > 0 && (
                <Link
                  href="/projects"
                  className="st-card st-card-hover st-accent st-accent-rose flex items-start justify-between gap-4 p-4 pl-6"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                      {shortProjects.length} project{shortProjects.length === 1 ? "" : "s"} may run short on filament
                    </p>
                    <ul className="mt-1.5 space-y-0.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {shortProjects.slice(0, 4).map(({ project, stock }) => (
                        <li key={project.id} className="truncate" title={describeShortage(stock)}>
                          {project.name}
                        </li>
                      ))}
                      {shortProjects.length > 4 && <li>+{shortProjects.length - 4} more</li>}
                    </ul>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">View →</span>
                </Link>
              )}

              {lowGroups.length > 0 && (
                <Link
                  href="/inventory"
                  className="st-card st-card-hover st-accent st-accent-amber flex items-start justify-between gap-4 p-4 pl-6"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                      {lowGroups.length} color{lowGroups.length === 1 ? "" : "s"} to reorder
                    </p>
                    <ul className="mt-1.5 space-y-0.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {lowGroups.slice(0, 4).map((group) => (
                        <li key={group.key} className="truncate">
                          {group.brand} {group.color} {group.material} · Approx. {Math.round(group.totalGrams)} g
                        </li>
                      ))}
                      {lowGroups.length > 4 && <li>+{lowGroups.length - 4} more</li>}
                    </ul>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">View →</span>
                </Link>
              )}
            </div>
          </section>
        )}

        {/* The three areas, each with its own colour so it's recognisable again on its own page header. */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {sections.map((item, index) => {
            const Icon = item.icon;
            const badge = ["st-badge-blue", "st-badge-violet", "st-badge-amber"][index];
            return (
              <Link key={item.label} href={item.href} className="st-card st-card-hover group p-5">
                <span className={`st-badge ${badge}`}>
                  <Icon />
                </span>
                <p className="mt-4 font-display text-lg font-semibold tracking-[-0.01em] text-slate-950 dark:text-white">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description}</p>
                <p className="mt-3 text-xs font-semibold text-blue-600 transition-transform duration-150 group-hover:translate-x-0.5 dark:text-blue-400">
                  Open →
                </p>
              </Link>
            );
          })}
        </div>

        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="st-section-title">At a glance</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">Live from your inventory and projects</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="st-card p-5">
              <p className="st-stat-value">{spoolCount}</p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Rolls on hand</p>
            </div>
            <div className="st-card p-5">
              <p className="st-stat-value">
                {(totalGrams / 1000).toFixed(1)}
                <span className="ml-1 text-lg font-medium text-slate-400 dark:text-slate-500">kg</span>
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Total filament on hand</p>
            </div>
            <div className="st-card p-5">
              <p className="st-stat-value">
                {stockValue.estimated && <span className="mr-1 text-lg font-medium text-slate-400 dark:text-slate-500">≈</span>}
                {money(stockValue.value)}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Filament value at price paid{stockValue.estimated ? " (some rolls unpriced)" : ""}
              </p>
            </div>
            <div className={`st-card p-5 ${lowGroups.length > 0 ? "st-accent st-accent-amber pl-7" : ""}`}>
              <p className={`st-stat-value ${lowGroups.length > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                {lowGroups.length}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Colors to reorder</p>
            </div>
            <div className="st-card p-5">
              <p className="st-stat-value">{activeProjects.length}</p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Active projects</p>
            </div>
            <div className={`st-card p-5 ${shortProjects.length > 0 ? "st-accent st-accent-rose pl-7" : ""}`}>
              <p className={`st-stat-value ${shortProjects.length > 0 ? "text-rose-600 dark:text-rose-400" : ""}`}>
                {shortProjects.length}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Projects that may run short</p>
            </div>
            <div
              className={`st-card p-5 ${
                maintenanceUrgentPrinters.length > 0
                  ? "st-accent st-accent-rose pl-7"
                  : maintenanceDuePrinters.length > 0
                    ? "st-accent st-accent-blue pl-7"
                    : ""
              }`}
            >
              <p
                className={`st-stat-value ${
                  maintenanceUrgentPrinters.length > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : maintenanceDuePrinters.length > 0
                      ? "text-blue-600 dark:text-blue-400"
                      : ""
                }`}
              >
                {maintenanceDuePrinters.length}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Printers due for service within {MAINTENANCE_UPCOMING_WINDOW_DAYS} days
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
            <Link
              href="/settings?tab=pricing"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Pricing settings →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
