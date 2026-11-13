"use client";

import { Select } from "@/components/Select";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ListScroll, Pager, usePaged } from "@/components/Pager";
import { addedLabel } from "@/lib/format-date";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { ROLL_LEVEL_LABELS } from "@/lib/inventory-constants";
import { addRoll, deleteRoll, incrementRollQuantity, setRollReorderExclusion, subscribeToRolls, updateRoll, type Roll } from "@/lib/rolls";
import { getInventorySettings, DEFAULT_INVENTORY_SETTINGS, type InventorySettings } from "@/lib/inventory-settings";
import { InventoryReport } from "@/components/InventoryReport";
import { groupLowRolls, groupKey, statusByKey } from "@/lib/inventory-status";
import { SORT_OPTIONS, sortRolls, type SortOption } from "@/lib/inventory-sort";
import { exportRollsToExcel } from "@/lib/inventory-export";
import { subscribeToProjects, type Project } from "@/lib/projects";
import { SpoolArt } from "@/components/ui/Art";

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
  const [projects, setProjects] = useState<Project[]>([]);

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

  useEffect(() => {
    if (!user) return;
    return subscribeToProjects(user.uid, setProjects);
  }, [user]);

  const projectsByRollId = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const project of projects) {
      for (const need of project.colorsNeeded) {
        for (const rollId of need.rollIds) {
          const entry = map.get(rollId) ?? [];
          if (!entry.some((p) => p.id === project.id)) entry.push({ id: project.id, name: project.name });
          map.set(rollId, entry);
        }
      }
    }
    return map;
  }, [projects]);

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
  // List view only: 15 rows per page inside a scrolling box, so a big inventory doesn't stretch the page.
  const paged = usePaged(sorted, `${search}|${materialFilter}|${colorFilter}|${sortBy}`, 15);

  async function handleDelete(roll: Roll) {
    if (!window.confirm(`Delete this ${roll.brand} ${roll.color} ${roll.material} roll?`)) return;
    try {
      await deleteRoll(roll.id);
    } catch (error) {
      setRollsError(error instanceof Error ? error.message : "Couldn't delete that roll. Please try again.");
    }
  }

  function handleRollDoubleClick(event: MouseEvent<HTMLElement>, rollId: string) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, label, select")) return;
    router.push(`/inventory/${rollId}/edit`);
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
    setQuickAddWarning("");
    setQuickAdding(true);
    try {
      if (roll.level === "full") {
        await incrementRollQuantity(roll.id, 1, roll.sizeGrams);
      } else if (roll.remainingGrams === 0) {
        // Nothing to keep in a 0g entry — restock it in place instead of leaving a stale duplicate.
        const match = rolls.find(
          (r) =>
            r.id !== roll.id &&
            r.level === "full" &&
            r.brand === roll.brand &&
            r.material === roll.material &&
            r.color === roll.color &&
            r.sizeGrams === roll.sizeGrams,
        );
        if (match) {
          await incrementRollQuantity(match.id, 1, match.sizeGrams);
        } else {
          await updateRoll(roll.id, {
            brand: roll.brand,
            material: roll.material,
            color: roll.color,
            sizeGrams: roll.sizeGrams,
            price: roll.price,
            level: "full",
            quantity: 1,
            excludeFromReorder: roll.excludeFromReorder,
            notes: roll.notes,
          });
        }
      } else {
        // Genuinely partial roll still in use — add a fresh full roll alongside it.
        const match = rolls.find(
          (r) =>
            r.level === "full" &&
            r.brand === roll.brand &&
            r.material === roll.material &&
            r.color === roll.color &&
            r.sizeGrams === roll.sizeGrams,
        );
        if (match) {
          await incrementRollQuantity(match.id, 1, match.sizeGrams);
        } else if (user) {
          await addRoll(user.uid, {
            brand: roll.brand,
            material: roll.material,
            color: roll.color,
            sizeGrams: roll.sizeGrams,
            price: roll.price,
            level: "full",
            quantity: 1,
            excludeFromReorder: false,
          });
        }
      }
    } catch (error) {
      setRollsError(error instanceof Error ? error.message : "Couldn't quick-add a roll. Please try again.");
    } finally {
      setQuickAdding(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-svh flex-1 items-center justify-center st-page">
        <p className="st-loading">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-1 flex-col st-page">
      <Header />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:px-10">
        <BackLink />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="st-badge st-badge-blue mt-1">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden="true">
                <circle cx="10" cy="10" r="7" />
                <circle cx="10" cy="10" r="2.5" />
              </svg>
            </span>
            <div>
              <p className="st-eyebrow">Inventory</p>
              <h1 className="st-title mt-1">Filament rolls</h1>
              <p className="st-lede mt-2">Every spool on the shelf, with how much is left and what needs reordering.</p>
            </div>
          </div>
          <div className="flex gap-3">
            {selectedRollId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRollId(null);
                  setQuickAddWarning("");
                }}
                className="st-btn-secondary h-11 px-3 text-slate-500 dark:text-slate-400"
              >
                Clear selection
              </button>
            )}
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={rolls.length === 0 || quickAdding}
              title="Select a roll below, then click here: full rolls get +1 to quantity, partial rolls get a new full roll added of the same type"
              className="st-btn-secondary h-11 px-4"
            >
              <DuplicateIcon />
              {quickAdding ? "Adding…" : "Quick add"}
            </button>
            <Link
              href="/inventory/new"
              className="flex h-11 items-center gap-2 st-btn-primary px-4"
            >
              <PlusIcon />
              Add roll
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <InventoryReport rolls={rolls} settings={settings} />
        </div>

        <div className="st-toolbar mt-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brand, material, color…"
            className="h-11 min-w-[200px] flex-1 rounded-xl border border-transparent bg-slate-100/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:bg-white dark:bg-white/[0.05] dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-white/[0.08]"
          />
          <Select
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
            className="h-11 rounded-xl border border-transparent bg-slate-100/70 px-3 text-sm text-slate-950 focus:bg-white dark:bg-white/[0.05] dark:text-white dark:focus:bg-white/[0.08]"
          >
            {materials.map((m) => (
              <option key={m} value={m}>
                {m === "All" ? "All materials" : m}
              </option>
            ))}
          </Select>
          <Select
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
            className="h-11 rounded-xl border border-transparent bg-slate-100/70 px-3 text-sm text-slate-950 focus:bg-white dark:bg-white/[0.05] dark:text-white dark:focus:bg-white/[0.08]"
          >
            {colors.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All colors" : c}
              </option>
            ))}
          </Select>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-11 rounded-xl border border-transparent bg-slate-100/70 px-3 text-sm text-slate-950 focus:bg-white dark:bg-white/[0.05] dark:text-white dark:focus:bg-white/[0.08]"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </Select>
          <div className="st-segment">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className={`flex h-full items-center rounded-lg px-2.5 transition-colors ${
                viewMode === "grid"
                  ? "st-segment-on"
                  : "st-segment-off"
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
                  ? "st-segment-on"
                  : "st-segment-off"
              }`}
            >
              <ListIcon />
            </button>
          </div>
          <button
            type="button"
            onClick={() => exportRollsToExcel(sorted)}
            disabled={sorted.length === 0}
            className="st-btn-secondary h-11 px-4"
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
            <div className="st-empty st-rise px-8 py-12">
              <SpoolArt className="mx-auto h-28 w-auto" />
              <p className="mt-4 font-display text-lg font-semibold tracking-[-0.01em] text-slate-950 dark:text-white">
                {rolls.length === 0 ? "No rolls yet." : "No rolls match your filters."}
              </p>
              {rolls.length === 0 && (
                <p className="st-lede mx-auto mt-1 max-w-sm">Add the spools you have on hand and SpoolTally will keep track of what&rsquo;s left.</p>
              )}
              {rolls.length === 0 && (
                <Link
                  href="/inventory/new"
                  className="st-btn-primary mt-6 h-11 px-5"
                >
                  <PlusIcon />
                  Add your first roll
                </Link>
              )}
            </div>
          ) : viewMode === "list" ? (
            <div className="st-card overflow-hidden">
              <ListScroll page={paged.pager.page}>
              {/* Column headings share the row widths below, so everything lines up on wide screens. */}
              <div className="sticky top-0 z-10 hidden items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 dark:bg-[#0b1420] text-[11px] font-bold tracking-[0.12em] text-slate-400 uppercase lg:flex dark:border-white/10">
                <span className="w-4 shrink-0" />
                <span className="min-w-[160px] flex-1">Roll</span>
                <span className="w-24 shrink-0 text-center">Level</span>
                <span className="w-20 shrink-0">On hand</span>
                <span className="w-20 shrink-0">Price</span>
                <span className="w-36 shrink-0 pl-3">Reorder</span>
                <span className="w-24 shrink-0 text-center">Status</span>
                <span className="w-[124px] shrink-0 text-center">Actions</span>
              </div>
              {paged.pageItems.map((roll, i) => {
                const status = stockStatusByKey.get(groupKey(roll));
                return (
                  <div
                    key={roll.id}
                    onDoubleClick={(event) => handleRollDoubleClick(event, roll.id)}
                    title="Double-click to open roll details"
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.03] ${
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
                      onClick={() => {
                        if (selectedRollId === roll.id) {
                          setSelectedRollId(null);
                          setQuickAddWarning("");
                        }
                      }}
                      aria-label="Select this roll for quick add"
                      title="Select for quick add, or click again to deselect"
                      className="h-4 w-4 shrink-0 border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/20"
                    />
                    <div className="min-w-[160px] flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {roll.color} {roll.material}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {roll.brand}
                        {addedLabel(roll.createdAt) && ` · ${addedLabel(roll.createdAt)}`}
                      </p>
                      {roll.notes && (
                        <p className="mt-0.5 text-[11px] text-slate-400 italic dark:text-slate-500" title={roll.notes}>
                          {roll.notes}
                        </p>
                      )}
                      {(projectsByRollId.get(roll.id)?.length ?? 0) > 0 && (
                        <p className="text-[11px]">
                          <Link
                            href={`/inventory/${roll.id}/edit`}
                            title="Open roll details to see which projects use this roll"
                            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Used in {projectsByRollId.get(roll.id)!.length} project{projectsByRollId.get(roll.id)!.length === 1 ? "" : "s"}
                          </Link>
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 lg:w-24 lg:text-center">
                      <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                        {ROLL_LEVEL_LABELS[roll.level]}
                        {roll.level === "full" && roll.quantity > 1 ? ` ×${roll.quantity}` : ""}
                      </span>
                    </span>
                    <span className="w-20 shrink-0 text-xs text-slate-600 tabular-nums dark:text-slate-300">
                      {Math.round(roll.remainingGrams).toLocaleString()} g
                    </span>
                    <span className="w-20 shrink-0 text-xs text-slate-600 tabular-nums dark:text-slate-300">
                      ${roll.price.toFixed(2)}
                    </span>
                    <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500 lg:w-36 lg:pl-3 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={roll.excludeFromReorder}
                        onChange={() => handleToggleReorderExclusion(roll)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/20"
                      />
                      Hide from reorder
                    </label>
                    <span className={`shrink-0 lg:block lg:w-24 lg:text-center ${status ? "" : "hidden"}`}>
                      {status && (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            status === "reorder"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                          }`}
                        >
                          {status === "reorder" ? "Order soon" : "Last roll"}
                        </span>
                      )}
                    </span>
                    <div className="ml-auto flex shrink-0 justify-end gap-2 lg:w-[124px] lg:justify-center">
                      {/* Keeps the edit and delete buttons in the same spot on rows without a +1 button. */}
                      {roll.level !== "full" && <span aria-hidden="true" className="hidden h-8 w-[38px] lg:block" />}
                      {roll.level === "full" && (
                        <button
                          type="button"
                          onClick={() => handleQuickAddOne(roll)}
                          title="Add +1 to this roll's quantity"
                          className="st-btn-secondary h-8 px-2.5 text-xs lg:w-[38px] lg:px-0"
                        >
                          +1
                        </button>
                      )}
                      <Link
                        href={`/inventory/${roll.id}/edit`}
                        aria-label="Edit roll"
                        className="st-btn-secondary h-8 w-8"
                      >
                        <PencilIcon />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(roll)}
                        aria-label="Delete roll"
                        className="st-btn-danger h-8 w-8"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
              </ListScroll>
              <Pager {...paged.pager} noun="rolls" className="border-t border-slate-100 px-5 py-3 dark:border-white/10" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((roll) => {
                const status = stockStatusByKey.get(groupKey(roll));
                return (
                <div
                  key={roll.id}
                  onDoubleClick={(event) => handleRollDoubleClick(event, roll.id)}
                  title="Double-click to open roll details"
                  className={`st-card st-card-hover flex flex-col p-4 ${
                    selectedRollId === roll.id
                      ? "outline outline-2 outline-offset-2 outline-blue-500/70"
                      : status === "reorder"
                        ? "st-accent st-accent-rose pl-6"
                        : status === "warn"
                          ? "st-accent st-accent-amber pl-6"
                          : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="quickAddSelect"
                        checked={selectedRollId === roll.id}
                        onChange={() => handleSelectRoll(roll.id)}
                        onClick={() => {
                          if (selectedRollId === roll.id) {
                            setSelectedRollId(null);
                            setQuickAddWarning("");
                          }
                        }}
                        aria-label="Select this roll for quick add"
                        title="Select for quick add, or click again to deselect"
                        className="mt-1 h-4 w-4 shrink-0 border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/20"
                      />
                      <div>
                        <p className="font-display text-base leading-tight font-semibold tracking-[-0.01em] text-slate-950 dark:text-white">{roll.color}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {roll.brand} · {roll.material}
                          {addedLabel(roll.createdAt) && <span className="block text-[11px] text-slate-400 dark:text-slate-500">{addedLabel(roll.createdAt)}</span>}
                        </p>
                        {roll.notes && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400 italic dark:text-slate-500" title={roll.notes}>
                            {roll.notes}
                          </p>
                        )}
                        {(projectsByRollId.get(roll.id)?.length ?? 0) > 0 && (
                          <p className="text-[11px] text-blue-600 dark:text-blue-400">
                            Used in:{" "}
                            {projectsByRollId.get(roll.id)!.map((p, i, arr) => (
                              <span key={p.id}>
                                <Link href={`/projects/${p.id}/edit`} className="hover:underline">
                                  {p.name}
                                </Link>
                                {i < arr.length - 1 ? ", " : ""}
                              </span>
                            ))}
                          </p>
                        )}
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

                  <div
                    className={`st-gauge mt-4 ${status === "reorder" ? "st-gauge-low" : status === "warn" ? "st-gauge-warn" : ""}`}
                    aria-hidden="true"
                  >
                    <span
                      style={{
                        width: `${Math.max(0, Math.min(100, (roll.remainingGrams / Math.max(1, roll.sizeGrams * Math.max(1, roll.quantity || 1))) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    <span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{Math.round(roll.remainingGrams)} g</span> on hand
                    </span>
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
                        className="st-btn-secondary h-9 px-3 text-xs"
                      >
                        +1
                      </button>
                    )}
                    <Link
                      href={`/inventory/${roll.id}/edit`}
                      className="st-btn-secondary h-9 flex-1 text-xs"
                    >
                      <PencilIcon />
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(roll)}
                      className="st-btn-danger h-9 flex-1 text-xs"
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
