"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { ROLL_LEVEL_LABELS } from "@/lib/inventory-constants";
import { deleteRoll, subscribeToRolls, type Roll } from "@/lib/rolls";
import { getInventorySettings, DEFAULT_INVENTORY_SETTINGS, type InventorySettings } from "@/lib/inventory-settings";
import { InventoryReport } from "@/components/InventoryReport";

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

export default function InventoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [rollsLoading, setRollsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [materialFilter, setMaterialFilter] = useState("All");
  const [colorFilter, setColorFilter] = useState("All");
  const [settings, setSettings] = useState<InventorySettings>(DEFAULT_INVENTORY_SETTINGS);

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
      },
      () => setRollsLoading(false),
    );
  }, [user]);

  const materials = useMemo(() => ["All", ...Array.from(new Set(rolls.map((r) => r.material)))], [rolls]);
  const colors = useMemo(() => ["All", ...Array.from(new Set(rolls.map((r) => r.color)))], [rolls]);

  const filtered = rolls.filter((r) => {
    if (materialFilter !== "All" && r.material !== materialFilter) return false;
    if (colorFilter !== "All" && r.color !== colorFilter) return false;
    if (search.trim()) {
      const haystack = `${r.brand} ${r.material} ${r.color}`.toLowerCase();
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });

  async function handleDelete(roll: Roll) {
    if (!window.confirm(`Delete this ${roll.brand} ${roll.color} ${roll.material} roll?`)) return;
    await deleteRoll(roll.id);
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
          <Link
            href="/inventory/new"
            className="flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            <PlusIcon />
            Add roll
          </Link>
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
        </div>

        <div className="mt-6">
          {rollsLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading rolls…</p>
          ) : filtered.length === 0 ? (
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
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((roll) => (
                <div
                  key={roll.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{roll.color}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {roll.brand} · {roll.material}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      {ROLL_LEVEL_LABELS[roll.level]}
                      {roll.level === "full" && roll.quantity > 1 ? ` ×${roll.quantity}` : ""}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{Math.round(roll.remainingGrams)} g on hand</span>
                    <span>${roll.price.toFixed(2)} paid</span>
                  </div>

                  <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
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
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
