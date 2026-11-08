"use client";

import { useMemo, useState } from "react";
import type { Roll } from "@/lib/rolls";
import { saveInventorySettings, type InventorySettings } from "@/lib/inventory-settings";
import { groupLowRolls, type StockStatus } from "@/lib/inventory-status";
import { exportReorderReportToExcel } from "@/lib/inventory-export";

type ReportFilter = "all" | StockStatus;

const FILTER_OPTIONS: { value: ReportFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "reorder", label: "Reorder now" },
  { value: "warn", label: "Low" },
];

function FilterIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M3 5h14M6 10h8M8.5 15h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M10 3v9m0 0 3.5-3.5M10 12l-3.5-3.5M4 14.5v1a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M10 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M10 3v1.6M10 15.4V17M3 10h1.6M15.4 10H17M5.1 5.1l1.1 1.1M13.8 13.8l1.1 1.1M14.9 5.1l-1.1 1.1M6.2 13.8l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

type InventoryReportProps = {
  ownerId: string;
  rolls: Roll[];
  settings: InventorySettings;
  onSettingsChange: (settings: InventorySettings) => void;
};

/** Low-filament report: flags material/color groups below the user's reorder/warn thresholds. */
export function InventoryReport({ ownerId, rolls, settings, onSettingsChange }: InventoryReportProps) {
  const [editingSettings, setEditingSettings] = useState(false);
  const [reorderBelowRolls, setReorderBelowRolls] = useState(settings.reorderBelowRolls);
  const [warnAtRolls, setWarnAtRolls] = useState(settings.warnAtRolls);
  const [savingSettings, setSavingSettings] = useState(false);
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const groups = useMemo(() => groupLowRolls(rolls, settings), [rolls, settings]);
  const visibleGroups = useMemo(
    () => (filter === "all" ? groups : groups.filter((g) => g.status === filter)),
    [groups, filter],
  );

  async function handleSaveSettings() {
    setSavingSettings(true);
    const next: InventorySettings = {
      reorderBelowRolls: Math.max(0, reorderBelowRolls),
      warnAtRolls: Math.max(0, warnAtRolls),
    };
    try {
      await saveInventorySettings(ownerId, next);
      onSettingsChange(next);
      setEditingSettings(false);
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Reorder report</p>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <FilterIcon />
              {filter === "all" ? "Filter" : FILTER_OPTIONS.find((o) => o.value === filter)?.label}
            </button>
            {filterOpen && (
              <div className="absolute right-0 z-10 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#0b1018]">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setFilter(opt.value);
                      setFilterOpen(false);
                    }}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${
                      filter === opt.value
                        ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => exportReorderReportToExcel(visibleGroups)}
            disabled={visibleGroups.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:text-white"
          >
            <DownloadIcon />
            Export to Excel
          </button>
          <button
            type="button"
            onClick={() => setEditingSettings((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <GearIcon />
            Thresholds
          </button>
        </div>
      </div>

      {editingSettings && (
        <div className="mt-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 dark:border-white/10 dark:bg-white/[0.02]">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Flag &ldquo;Reorder now&rdquo; when below (rolls)
            </label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={reorderBelowRolls}
              onChange={(e) => setReorderBelowRolls(Number(e.target.value))}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Warn &ldquo;Low&rdquo; when at or below (rolls)
            </label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={warnAtRolls}
              onChange={(e) => setWarnAtRolls(Number(e.target.value))}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={savingSettings}
              onClick={handleSaveSettings}
              className="h-9 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingSettings ? "Saving…" : "Save thresholds"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4">
        {groups.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Everything&rsquo;s stocked above your thresholds. Nothing to reorder.
          </p>
        ) : visibleGroups.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nothing matches this filter.</p>
        ) : (
          <ul className="space-y-2">
            {visibleGroups.map((g) => (
              <li
                key={g.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-sm dark:border-white/10"
              >
                <span className="text-slate-700 dark:text-slate-200">
                  {g.brand} {g.color} {g.material}
                  <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                    ~{g.rollsEquivalent.toFixed(2)} rolls ({Math.round(g.totalGrams)} g)
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    g.status === "reorder"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  }`}
                >
                  {g.status === "reorder" ? "Reorder now" : "Low — order soon"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
