"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ComboSelect } from "@/components/ComboSelect";
import { CloseLink } from "@/components/CloseLink";
import {
  BRAND_OPTIONS,
  COLOR_OPTIONS,
  MATERIAL_OPTIONS,
  ROLL_LEVELS,
  ROLL_LEVEL_LABELS,
  SIZE_OPTIONS_GRAMS,
  CUSTOM_OPTION,
  type RollLevel,
} from "@/lib/inventory-constants";
import { addRoll, incrementRollQuantity, listRolls, updateRoll, type Roll } from "@/lib/rolls";

type RollFormProps = {
  roll?: Roll;
};

/** Add/edit form for a single filament roll entry. */
export function RollForm({ roll }: RollFormProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [brand, setBrand] = useState(roll?.brand ?? BRAND_OPTIONS[0]);
  const [material, setMaterial] = useState(roll?.material ?? MATERIAL_OPTIONS[0]);
  const [color, setColor] = useState(roll?.color ?? COLOR_OPTIONS[0]);
  const [sizeIsCustom, setSizeIsCustom] = useState(
    () => roll !== undefined && !SIZE_OPTIONS_GRAMS.includes(roll.sizeGrams as 1000),
  );
  const [sizeGrams, setSizeGrams] = useState(roll?.sizeGrams ?? 1000);
  const [price, setPrice] = useState(roll ? String(roll.price) : "");
  const [level, setLevel] = useState<RollLevel>(roll?.level ?? "full");
  const [quantity, setQuantity] = useState(roll?.quantity ?? 1);
  const [excludeFromReorder, setExcludeFromReorder] = useState(roll?.excludeFromReorder ?? false);
  const [notes, setNotes] = useState(roll?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existingRolls, setExistingRolls] = useState<Roll[]>([]);
  const [duplicateMatch, setDuplicateMatch] = useState<Roll | null>(null);

  const [initial] = useState(() => ({
    brand: roll?.brand ?? BRAND_OPTIONS[0],
    material: roll?.material ?? MATERIAL_OPTIONS[0],
    color: roll?.color ?? COLOR_OPTIONS[0],
    sizeGrams: roll?.sizeGrams ?? 1000,
    price: roll ? String(roll.price) : "",
    level: roll?.level ?? "full",
    quantity: roll?.quantity ?? 1,
    excludeFromReorder: roll?.excludeFromReorder ?? false,
    notes: roll?.notes ?? "",
  }));

  const isDirty =
    brand !== initial.brand ||
    material !== initial.material ||
    color !== initial.color ||
    sizeGrams !== initial.sizeGrams ||
    price !== initial.price ||
    level !== initial.level ||
    quantity !== initial.quantity ||
    excludeFromReorder !== initial.excludeFromReorder ||
    notes !== initial.notes;

  useEffect(() => {
    if (roll || !user) return;
    let active = true;
    listRolls(user.uid).then((rolls) => {
      if (active) setExistingRolls(rolls);
    });
    return () => {
      active = false;
    };
  }, [roll, user]);

  function resetForm() {
    setBrand(BRAND_OPTIONS[0]);
    setMaterial(MATERIAL_OPTIONS[0]);
    setColor(COLOR_OPTIONS[0]);
    setSizeIsCustom(false);
    setSizeGrams(1000);
    setPrice("");
    setLevel("full");
    setQuantity(1);
    setExcludeFromReorder(false);
    setNotes("");
  }

  async function performSave() {
    if (!user) return;
    setSaving(true);
    try {
      const input = {
        brand,
        material,
        color,
        sizeGrams,
        price: Number(price) || 0,
        level,
        quantity: level === "full" ? Math.max(1, quantity) : 1,
        excludeFromReorder,
        notes,
      };
      if (roll) {
        await updateRoll(roll.id, input);
      } else {
        await addRoll(user.uid, input);
      }
      setSaving(false);
      if (!roll) resetForm();
      router.push("/inventory");
    } catch {
      setError("Something went wrong saving this roll. Please try again.");
      setSaving(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");

    if (!roll && level === "full") {
      const match = existingRolls.find(
        (r) =>
          r.brand === brand &&
          r.material === material &&
          r.color === color &&
          r.sizeGrams === sizeGrams &&
          (r.level === "full" || r.remainingGrams === 0),
      );
      if (match) {
        setDuplicateMatch(match);
        return;
      }
    }

    await performSave();
  }

  async function handleMergeIntoExisting() {
    if (!duplicateMatch) return;
    setError("");
    setSaving(true);
    try {
      await incrementRollQuantity(duplicateMatch.id, Math.max(1, quantity), sizeGrams);
      setSaving(false);
      setDuplicateMatch(null);
      resetForm();
      router.push("/inventory");
    } catch {
      setError("Couldn't update that roll. Please try again.");
      setSaving(false);
    }
  }

  async function handleAddSeparately() {
    setDuplicateMatch(null);
    await performSave();
  }

  async function handleReplaceEntry() {
    if (!duplicateMatch) return;
    setError("");
    setSaving(true);
    try {
      await updateRoll(duplicateMatch.id, {
        brand,
        material,
        color,
        sizeGrams,
        price: Number(price) || 0,
        level,
        quantity: Math.max(1, quantity),
        excludeFromReorder,
        notes,
      });
      setSaving(false);
      setDuplicateMatch(null);
      resetForm();
      router.push("/inventory");
    } catch {
      setError("Couldn't update that roll. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="flex justify-end">
        <CloseLink href="/inventory" dirty={isDirty} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <ComboSelect label="Brand" value={brand} onChange={setBrand} options={BRAND_OPTIONS} customPlaceholder="e.g. Local Shop Filament" />
        <ComboSelect label="Material" value={material} onChange={setMaterial} options={MATERIAL_OPTIONS} customPlaceholder="e.g. HIPS" />
      </div>

      <ComboSelect label="Color" value={color} onChange={setColor} options={COLOR_OPTIONS} customPlaceholder="e.g. Galaxy Purple" />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Roll size</label>
          <select
            value={sizeIsCustom ? CUSTOM_OPTION : sizeGrams}
            onChange={(e) => {
              if (e.target.value === CUSTOM_OPTION) {
                setSizeIsCustom(true);
              } else {
                setSizeIsCustom(false);
                setSizeGrams(Number(e.target.value));
              }
            }}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          >
            {SIZE_OPTIONS_GRAMS.map((g) => (
              <option key={g} value={g}>
                {g} g
              </option>
            ))}
            <option value={CUSTOM_OPTION}>{CUSTOM_OPTION}</option>
          </select>
          {sizeIsCustom && (
            <input
              autoFocus
              required
              type="number"
              min={1}
              value={sizeGrams}
              onChange={(e) => setSizeGrams(Number(e.target.value))}
              placeholder="Grams"
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
            />
          )}
        </div>

        <div>
          <label htmlFor="price" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Price paid
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-slate-400">$</span>
            <input
              id="price"
              type="number"
              min={0}
              step="0.01"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="18.99"
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Level remaining</label>
        <div className="grid grid-cols-5 gap-2">
          {ROLL_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              className={`h-11 rounded-xl text-sm font-semibold transition-colors ${
                level === l
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]"
              }`}
            >
              {ROLL_LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      {level === "full" && (
        <div>
          <label htmlFor="quantity" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            How many full rolls like this?
          </label>
          <input
            id="quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="h-12 w-32 rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          />
        </div>
      )}

      <div>
        <label htmlFor="rollNotes" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Notes <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
        </label>
        <textarea
          id="rollNotes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Lot number, where you bought it, temps that worked, runs stringy…"
          className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
        />
      </div>

      <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={excludeFromReorder}
          onChange={(e) => setExcludeFromReorder(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/20"
        />
        Hide this roll from the reorder report
      </label>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      {duplicateMatch ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          {duplicateMatch.level === "full" ? (
            <>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                You already have {duplicateMatch.quantity} full {sizeGrams}g roll
                {duplicateMatch.quantity === 1 ? "" : "s"} of {brand} {color} {material}.
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300/80">
                Add {Math.max(1, quantity)} more to that entry instead of creating a duplicate, or add this as a
                separate roll anyway.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleMergeIntoExisting}
                  className="flex h-10 items-center justify-center rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Updating…" : `Add to existing (→ ${duplicateMatch.quantity + Math.max(1, quantity)} total)`}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleAddSeparately}
                  className="flex h-10 items-center justify-center rounded-lg border border-amber-300 bg-white px-4 text-xs font-semibold text-amber-800 transition-colors disabled:cursor-not-allowed disabled:opacity-70 dark:border-amber-500/30 dark:bg-transparent dark:text-amber-200"
                >
                  Add as separate roll
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setDuplicateMatch(null)}
                  className="flex h-10 items-center justify-center rounded-lg px-4 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70 dark:text-amber-300 dark:hover:bg-amber-500/10"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                You have a 0g entry for {brand} {color} {material} (marked needs reorder).
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300/80">
                Replace that entry with this roll instead of creating a duplicate, or add this as a separate roll
                anyway.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleReplaceEntry}
                  className="flex h-10 items-center justify-center rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Updating…" : "Replace that entry"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleAddSeparately}
                  className="flex h-10 items-center justify-center rounded-lg border border-amber-300 bg-white px-4 text-xs font-semibold text-amber-800 transition-colors disabled:cursor-not-allowed disabled:opacity-70 dark:border-amber-500/30 dark:bg-transparent dark:text-amber-200"
                >
                  Add as separate roll
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setDuplicateMatch(null)}
                  className="flex h-10 items-center justify-center rounded-lg px-4 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70 dark:text-amber-300 dark:hover:bg-amber-500/10"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex h-12 flex-1 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-lg shadow-blue-950/15 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving…" : roll ? "Save changes" : "Add roll"}
          </button>
        </div>
      )}
    </form>
  );
}
