"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { ROLL_LEVEL_LABELS } from "@/lib/inventory-constants";
import { deleteRoll, incrementRollQuantity, setRollReorderExclusion, subscribeToRolls, type Roll } from "@/lib/rolls";
import { getInventorySettings, DEFAULT_INVENTORY_SETTINGS, type InventorySettings } from "@/lib/inventory-settings";
import { InventoryReport } from "@/components/InventoryReport";
import { groupLowRolls, groupKey, statusByKey } from "@/lib/inventory-status";
import { SORT_OPTIONS, sortRolls, type SortOption } from "@/lib/inventory-sort";
import { exportRollsToExcel } from "@/lib/inventory-export";

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M13.5 3.5 16 6l-8.5 8.5L4 15l.5-3.5L13.5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M4.5 6h11M8 6V4.5h4V6m-6 0 .6 9.2a1 1 0 0 0 1 .8h4.8a1 1 0 0 0 1-.8L14 6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <rect x="3" y="3" width="6" height="6" rx="1.3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M4 5.5h12M4 10h12M4 14.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <rect x="3.5" y="5.5" width="10" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 5V4.3A1.8 1.8 0 0 1 8.8 2.5h6.4A1.8 1.8 0 0 1 17 4.3v6.4a1.8 1.8 0 0 1-1.8 1.8H14.5" stroke="currentColor" strokeWidth="1.5" />
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

export default function InventoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [rollsLoading, setRollsLoading] = useState(true);
  const [rollsError, setRollsError] = useState("");
  const [search, setSearch] = useState("");
  const [materialFilter, setMaterialFilter] = useState("All");
  const [colorFilter, setColorFilter] = useState("All");
  const [settings, setSettings] = useState<InventorySettings>(DEFAULT_INVENTORY_SETTINGS);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [quickAdding, setQuickAdding] = useState(false);
  const [selectedRollId, setSelectedRollId] = useState<string | null>(null);
  const [quickAddWarning, setQuickAddWarning] = useState("");

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
    return subscribeToRolls(
      user.uid,
      (next) => {
        setRolls(next);
        setRollsLoading(false);
        setRollsError("");
      },
      (error) => {
        setRollsLoading(false);
        setRollsError(error.message || "Couldn't load your inventory. Please refresh and try again.");
      },
    );
  }, [user]);

  const materials = useMemo(() => ["All", ...Array.from(new Set(rolls.map((r) => r.material)))], [rolls]);
  const colors = useMemo(() => ["All", ...Array.from(new Set(rolls.map((r) => r.color)))], [rolls]);
  const stockStatusByKey = useMemo(() => statusByKey(groupLowRolls(rolls, settings)), [rolls, settings]);

  const filtered = rolls.filter((r) => {
    if (materialFilter !== "All" && r.material !== materialFilter) return false;
    if (colorFilter !== "All" && r.color !== colorFilter) return false;
    if (search.trim()) {
      const haystack = `${r.brand} ${r.material} ${r.color}`.toLowerCase();
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });
  const sorted = useMemo(() => sortRolls(filtered, sortBy), [filtered, sortBy]);

  async function handleDelete(roll: Roll) {
    if (!window.confirm(`Delete this ${roll.brand} ${roll.color} ${roll.material} roll?`)) return;
    try {
      await deleteRoll(roll.id);
    } catch (error) {
      setRollsError(error instanceof Error ? error.message : "Couldn't delete that roll. Please try again.");
    }
  }

  async function handleToggleReorderExclusion(roll: Roll) {
    try {
      await setRollReorderExclusion(roll.id, !roll.excludeFromReorder);
    } catch (error) {
      setRollsError(error instanceof Error ? error.message : "Couldn't update that roll. Please try again.");
    }
  }

  async function handleQuickAddOne(roll: Roll) {
    try {
      await incrementRollQuantity(roll.id, 1, roll.sizeGrams);
    } catch (error) {
      setRollsError(error instanceof Error ? error.message : "Couldn't add to that roll. Please try again.");
    }
  }

  function handleSelectRoll(rollId: string) {
    setSelectedRollId(rollId);
    setQuickAddWarning("");
  }

  async function handleQuickAdd() {
    if (!selectedRollId) {
      setQuickAddWarning("Select a roll from the list first, then click Quick add.");
      return;
    }
    const roll = rolls.find((r) => r.id === selectedRollId);
    if (!roll) {
      setSelectedRollId(null);
      setQuickAddWarning("That roll no longer exists. Select another.");
      return;
    }
    if (roll.level !== "full") {
      setQuickAddWarning("Quick add only works on full rolls. Edit this roll to change its quantity.");
      return;
    }
    setQuickAddWarning("");
    setQuickAdding(true);
    try {
      await incrementRollQuantity(roll.id, 1, roll.sizeGrams);
    } catch (error) {
      setRollsError(error instanceof Error ? error.message : "Couldn't quick-add a roll. Please try again.");
    } finally {
      setQuickAdding(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-svh flex-1 items-center justify-center bg-[#f5f8fc] dark:bg-[#05080e]">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-1 flex-col bg-[#f5f8fc] dark:bg-[#05080e]">
      <Header />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:px-10">
        <BackLink />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-400">Inventory</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl dark:text-white">
              Filament rolls
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={rolls.length === 0 || quickAdding}
              title="Select a full roll below, then click here to add +1 to its quantity"
              className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]"
            >
              <DuplicateIcon />
              {quickAdding ? "Adding…" : "Quick add"}
            </button>
            <Link
              href="/inventory/new"
              className="flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
            >
              <PlusIcon />
              Add roll
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <InventoryReport ownerId={user.uid} rolls={rolls} settings={settings} onSettingsChange={setSettings} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brand, material, color…"
            className="h-11 flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
          />
          <select
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          >
            {materials.map((m) => (
              <option key={m} value={m}>
                {m === "All" ? "All materials" : m}
              </option>
            ))}
          </select>
          <select
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          >
            {colors.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All colors" : c}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
          <div className="flex h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-white/[0.03]">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className={`flex h-full items-center rounded-lg px-2.5 transition-colors ${
                viewMode === "grid"
                  ? "bg-slate-950 text-white dark:bg-white/15"
                  : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5"
              }`}
            >
              <GridIcon />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              className={`flex h-full items-center rounded-lg px-2.5 transition-colors ${
                viewMode === "list"
                  ? "bg-slate-950 text-white dark:bg-white/15"
                  : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5"
              }`}
            >
              <ListIcon />
            </button>
          </div>
          <button
            type="button"
            onClick={() => exportRollsToExcel(sorted)}
            disabled={sorted.length === 0}
            className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            <DownloadIcon />
            Export to Excel
          </button>
        </div>

        {quickAddWarning && (
          <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            {quickAddWarning}
          </p>
        )}

        {rollsError && (
          <p className="mt-6 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {rollsError}
          </p>
        )}

        <div className="mt-6">
          {rollsLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading rolls…</p>
          ) : sorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-white/15 dark:bg-white/[0.02]">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {rolls.length === 0 ? "No rolls yet." : "No rolls match your filters."}
              </p>
              {rolls.length === 0 && (
                <Link
                  href="/inventory/new"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                >
                  <PlusIcon />
                  Add your first roll
                </Link>
              )}
            </div>
          ) : viewMode === "list" ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
              {sorted.map((roll, i) => {
                const status = stockStatusByKey.get(groupKey(roll));
                return (
                  <div
                    key={roll.id}
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm ${
                      i > 0 ? "border-t border-slate-100 dark:border-white/10" : ""
                    } ${
                      selectedRollId === roll.id
                        ? "bg-blue-50/70 ring-1 ring-inset ring-blue-300 dark:bg-blue-500/[0.08] dark:ring-blue-400/40"
                        : status === "reorder"
                          ? "bg-rose-50/60 dark:bg-rose-500/[0.06]"
                          : status === "warn"
                            ? "bg-amber-50/60 dark:bg-amber-500/[0.06]"
                            : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="quickAddSelect"
                      checked={selectedRollId === roll.id}
                      onChange={() => handleSelectRoll(roll.id)}
                      aria-label="Select this roll for quick add"
                      title="Select for quick add"
                      className="h-4 w-4 shrink-0 border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/20"
                    />
                    <div className="min-w-[160px] flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {roll.color} {roll.material}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{roll.brand}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      {ROLL_LEVEL_LABELS[roll.level]}
                      {roll.level === "full" && roll.quantity > 1 ? ` ×${roll.quantity}` : ""}
                    </span>
                    <span className="w-24 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                      {Math.round(roll.remainingGrams)} g
                    </span>
                    <span className="w-16 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                      ${roll.price.toFixed(2)}
                    </span>
                    <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={roll.excludeFromReorder}
                        onChange={() => handleToggleReorderExclusion(roll)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/20"
                      />
                      Hide from reorder
                    </label>
                    {status && (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          status === "reorder"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                        }`}
                      >
                        {status === "reorder" ? "Order soon" : "Last roll"}
                      </span>
                    )}
                    <div className="ml-auto flex shrink-0 gap-2">
                      {roll.level === "full" && (
                        <button
                          type="button"
                          onClick={() => handleQuickAddOne(roll)}
                          title="Add +1 to this roll's quantity"
                          className="flex h-8 items-center rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                        >
                          +1
                        </button>
                      )}
                      <Link
                        href={`/inventory/${roll.id}/edit`}
                        aria-label="Edit roll"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                      >
                        <PencilIcon />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(roll)}
                        aria-label="Delete roll"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-600 transition-colors hover:bg-rose-50 dark:border-white/10 dark:text-rose-400 dark:hover:bg-rose-500/10"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((roll) => {
                const status = stockStatusByKey.get(groupKey(roll));
                return (
                <div
                  key={roll.id}
                  className={`flex flex-col rounded-2xl border bg-white p-4 shadow-sm dark:bg-white/[0.03] ${
                    selectedRollId === roll.id
                      ? "border-blue-400 ring-1 ring-inset ring-blue-300 dark:border-blue-400/60 dark:ring-blue-400/40"
                      : status === "reorder"
                        ? "border-rose-300 dark:border-rose-500/40"
                        : status === "warn"
                          ? "border-amber-300 dark:border-amber-500/40"
                          : "border-slate-200 dark:border-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="quickAddSelect"
                        checked={selectedRollId === roll.id}
                        onChange={() => handleSelectRoll(roll.id)}
                        aria-label="Select this roll for quick add"
                        title="Select for quick add"
                        className="mt-1 h-4 w-4 shrink-0 border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/20"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{roll.color}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {roll.brand} · {roll.material}
                        </p>
                      </div>
                    </label>
                    <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      {ROLL_LEVEL_LABELS[roll.level]}
                      {roll.level === "full" && roll.quantity > 1 ? ` ×${roll.quantity}` : ""}
                    </span>
                  </div>

                  {status && (
                    <span
                      className={`mt-3 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        status === "reorder"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                      }`}
                    >
                      {status === "reorder" ? "Order soon — less than a roll" : "Last roll — running low"}
                    </span>
                  )}

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{Math.round(roll.remainingGrams)} g on hand</span>
                    <span>${roll.price.toFixed(2)} paid</span>
                  </div>

                  <label className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={roll.excludeFromReorder}
                      onChange={() => handleToggleReorderExclusion(roll)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/20"
                    />
                    Hide from reorder report
                  </label>

                  <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
                    {roll.level === "full" && (
                      <button
                        type="button"
                        onClick={() => handleQuickAddOne(roll)}
                        title="Add +1 to this roll's quantity"
                        className="flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                      >
                        +1
                      </button>
                    )}
                    <Link
                      href={`/inventory/${roll.id}/edit`}
                      className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                      <PencilIcon />
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(roll)}
                      className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:border-white/10 dark:text-rose-400 dark:hover:bg-rose-500/10"
                    >
                      <TrashIcon />
                      Delete
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
