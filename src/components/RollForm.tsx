"use client";

import { Select } from "@/components/Select";
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
  ROLL_LEVEL_FRACTIONS,
  gramsForLevel,
  swatchFor,
  type RollLevel,
} from "@/lib/inventory-constants";
import { FormSection, sectionIconProps } from "@/components/ui/FormSection";
import { SpoolPreview } from "@/components/ui/SpoolPreview";
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
    <form className="space-y-8" onSubmit={handleSubmit}>
      {/* Live summary of the roll being entered: it updates as the fields below change. */}
      <div className="flex items-center gap-4 rounded-2xl bg-[var(--st-surface-2)] p-4 shadow-[inset_0_0_0_1px_var(--st-ring)]">
        <SpoolPreview color={swatchFor(color)} fraction={ROLL_LEVEL_FRACTIONS[level]} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-400">{roll ? "This roll" : "New roll"}</p>
          <p className="mt-0.5 truncate font-display text-lg leading-tight font-semibold tracking-[-0.01em] text-slate-950 dark:text-white">
            {[brand, color, material].filter(Boolean).join(" ") || "Untitled roll"}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
            {Math.round(gramsForLevel(level, sizeGrams || 0, Math.max(1, quantity))).toLocaleString()} g on hand
            {Number(price) > 0 && sizeGrams > 0 ? ` · $${Number(price).toFixed(2)} a roll · ${((Number(price) / sizeGrams) * 100).toFixed(1)}¢ per gram` : ""}
          </p>
        </div>
        <CloseLink href="/inventory" dirty={isDirty} />
      </div>

      <FormSection
        title="Filament"
        hint="Who made it, what it is, and its color."
        icon={
          <svg {...sectionIconProps}>
            <circle cx="10" cy="10" r="7" />
            <circle cx="10" cy="10" r="2.5" />
          </svg>
        }
      >
      <div className="grid gap-5 sm:grid-cols-2">
        <ComboSelect label="Brand" value={brand} onChange={setBrand} options={BRAND_OPTIONS} customPlaceholder="e.g. Local Shop Filament" />
        <ComboSelect label="Material" value={material} onChange={setMaterial} options={MATERIAL_OPTIONS} customPlaceholder="e.g. HIPS" />
      </div>

      <ComboSelect label="Color" value={color} onChange={setColor} options={COLOR_OPTIONS} customPlaceholder="e.g. Galaxy Purple" />
      </FormSection>

      <FormSection
        title="Size and cost"
        hint="Used to work out what each gram costs you."
        icon={
          <svg {...sectionIconProps}>
            <path d="M10 3v14M13.5 6.2c-.6-1-1.9-1.6-3.5-1.6-2 0-3.5 1-3.5 2.6 0 3.6 7 1.7 7 5.4 0 1.6-1.5 2.8-3.5 2.8-1.8 0-3.200-.7-3.800-1.900" />
          </svg>
        }
      >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Roll size</label>
          <Select
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
          </Select>
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

      </FormSection>

      <FormSection
        title="Stock on hand"
        hint="How much is left on the spool right now."
        icon={
          <svg {...sectionIconProps}>
            <path d="M4 16V9M8.5 16V4M13 16v-5M17 16V7" />
          </svg>
        }
      >
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Level remaining</label>
        <div className="grid grid-cols-5 gap-2">
          {ROLL_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              aria-pressed={level === l}
              className={`flex h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-all ${
                level === l
                  ? "bg-blue-600 text-white shadow-[0_10px_20px_-10px_rgba(29,111,242,0.8)]"
                  : "border border-[var(--st-field-border)] bg-[var(--st-field)] text-slate-600 hover:-translate-y-0.5 hover:border-blue-400 dark:text-slate-300"
              }`}
            >
              {/* A tiny gauge showing how full this choice is. */}
              <span aria-hidden="true" className={`flex h-2 w-9 overflow-hidden rounded-full ${level === l ? "bg-white/25" : "bg-slate-200 dark:bg-white/10"}`}>
                <span className={`h-full rounded-full ${level === l ? "bg-white" : "bg-blue-500"}`} style={{ width: `${ROLL_LEVEL_FRACTIONS[l] * 100}%` }} />
              </span>
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

      </FormSection>

      <FormSection
        title="Notes and reorder"
        hint="Optional extras."
        icon={
          <svg {...sectionIconProps}>
            <path d="M5 3.5h7l3.5 3.5V16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1ZM7.5 10h5M7.5 13h3.5" />
          </svg>
        }
      >
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
      </FormSection>

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
            className="st-btn-primary h-12 flex-1"
          >
            {saving ? "Saving…" : roll ? "Save changes" : "Add roll"}
          </button>
        </div>
      )}
    </form>
  );
}
