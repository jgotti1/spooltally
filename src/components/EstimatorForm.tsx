"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
  type RollLevel,
} from "@/lib/inventory-constants";
import { subscribeToRolls, addRoll, type Roll } from "@/lib/rolls";
import { subscribeToProjects, addProject, updateProject, uploadProjectFile, type Project } from "@/lib/projects";
import { addEstimate, updateEstimate, type Estimate, type EstimateColorUsage } from "@/lib/estimates";
import {
  getEstimatorSettings,
  saveEstimatorSettings,
  DEFAULT_ESTIMATOR_SETTINGS,
  type EstimatorSettings,
} from "@/lib/estimator-settings";
import type { SalesChannelId } from "@/lib/estimator-constants";
import { calcCostBreakdown, calcSuggestedPrice, costPerGram, DEFAULT_ROLL_PRICE } from "@/lib/estimator-pricing";
import { parseModelFile, dataUrlToFile } from "@/lib/model-parsing";

type EstimatorFormProps = {
  estimate?: Estimate;
  /** Project id to pull colors-needed from on first load, e.g. from a "Get a cost estimate" link on the Project page. */
  initialProjectId?: string;
};

function emptyColorUsage(): EstimateColorUsage {
  return { material: MATERIAL_OPTIONS[0], color: COLOR_OPTIONS[0], grams: 0, rollId: null };
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

function UploadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M10 3v9m0-9 3 3m-3-3-3 3M4 13.5v1.8a1.2 1.2 0 0 0 1.2 1.2h9.6a1.2 1.2 0 0 0 1.2-1.2v-1.8"
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
      <path d="M10 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 3v1.6M10 15.4V17M3 10h1.6M15.4 10H17M5.1 5.1l1.1 1.1M13.8 13.8l1.1 1.1M14.9 5.1l-1.1 1.1M6.2 13.8l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

const money = (n: number) => `$${n.toFixed(2)}`;

export function EstimatorForm({ estimate, initialProjectId }: EstimatorFormProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(estimate?.name ?? "");
  const [colorsUsed, setColorsUsed] = useState<EstimateColorUsage[]>(
    estimate?.colorsUsed && estimate.colorsUsed.length > 0 ? estimate.colorsUsed : [emptyColorUsage()],
  );
  const [printHours, setPrintHours] = useState(estimate ? String(estimate.printHours) : "");
  const [quantity, setQuantity] = useState(estimate?.quantity ?? 1);
  const [channelId, setChannelId] = useState<SalesChannelId>(estimate?.channelId ?? "etsy");
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(estimate?.projectId ?? null);
  const [pullFromProjectId, setPullFromProjectId] = useState("");

  const [rolls, setRolls] = useState<Roll[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [settings, setSettings] = useState<EstimatorSettings>(DEFAULT_ESTIMATOR_SETTINGS);
  const [editingSettings, setEditingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [parsingIndex, setParsingIndex] = useState<number | null>(null);
  const [rowStatus, setRowStatus] = useState<Record<number, { kind: "ok" | "error"; message: string }>>({});
  const [modelPreviews, setModelPreviews] = useState<Record<number, { dataUrl: string; fileName: string }>>({});
  const [unknownColorRows, setUnknownColorRows] = useState<Set<number>>(new Set());
  const [colorWarning, setColorWarning] = useState("");
  const [accuracyNote, setAccuracyNote] = useState("");
  const [addingRollIndex, setAddingRollIndex] = useState<number | null>(null);
  const [newRoll, setNewRoll] = useState({
    brand: BRAND_OPTIONS[0] as string,
    sizeGrams: SIZE_OPTIONS_GRAMS[1] as number,
    level: "empty" as RollLevel,
    quantity: 1,
    price: 0,
  });
  const [savingRoll, setSavingRoll] = useState(false);

  const [initial] = useState(() => ({
    name: estimate?.name ?? "",
    colorsUsedJson: JSON.stringify(
      estimate?.colorsUsed && estimate.colorsUsed.length > 0 ? estimate.colorsUsed : [emptyColorUsage()],
    ),
    printHours: estimate ? String(estimate.printHours) : "",
    quantity: estimate?.quantity ?? 1,
  }));

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
    let active = true;
    getEstimatorSettings(user.uid).then((next) => {
      if (active) setSettings(next);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const rollsById = useMemo(() => new Map(rolls.map((r) => [r.id, r])), [rolls]);

  function updateColorUsage(index: number, patch: Partial<EstimateColorUsage>) {
    setColorsUsed((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;
        const merged: EstimateColorUsage = { ...row, ...patch };
        // Firestore rejects a literal `undefined` field value — drop it instead of writing it in,
        // since {...row, gramsSource: undefined} otherwise leaves that key explicitly set to undefined.
        if (merged.gramsSource === undefined) delete merged.gramsSource;
        return merged;
      }),
    );
  }

  function addColorUsageRow() {
    setColorsUsed((rows) => [...rows, emptyColorUsage()]);
  }

  function removeColorUsageRow(index: number) {
    setColorsUsed((rows) => rows.filter((_, i) => i !== index));
    setUnknownColorRows((s) => {
      const next = new Set<number>();
      for (const i of s) {
        if (i === index) continue;
        next.add(i > index ? i - 1 : i);
      }
      return next;
    });
  }

  function clearUnknownColor(index: number) {
    setUnknownColorRows((s) => {
      if (!s.has(index)) return s;
      const next = new Set(s);
      next.delete(index);
      return next;
    });
  }

  async function handleFileUpload(index: number, file: File | undefined) {
    if (!file) return;
    setError("");
    setColorWarning("");
    setAccuracyNote("");
    setRowStatus((s) => ({ ...s, [index]: { kind: "ok", message: "Reading file…" } }));
    setParsingIndex(index);
    try {
      const usage = colorsUsed[index];
      const result = await parseModelFile(file, usage.material);

      if (result.filaments && result.filaments.length > 1) {
        const unknownOffsets = result.filaments.flatMap((f, i) => (f.colorName ? [] : [i]));
        setColorsUsed((rows) => {
          const inserted = result.filaments!.map((f) => ({
            material: usage.material,
            color: f.colorName ?? usage.color,
            grams: Math.round(f.grams * 100) / 100,
            rollId: null,
            gramsSource: result.accuracy,
          }));
          return [...rows.slice(0, index), ...inserted, ...rows.slice(index + 1)];
        });
        setRowStatus({});
        setModelPreviews({});
        setUnknownColorRows(new Set(unknownOffsets.map((offset) => index + offset)));
      } else {
        setColorsUsed((rows) =>
          rows.map((row, i) => {
            if (i !== index) return row;
            const next = { ...row, gramsSource: result.accuracy };
            if (result.grams !== null) next.grams = Math.round(result.grams * 100) / 100;
            if (result.colorName && result.colorName !== row.color) {
              next.color = result.colorName;
              next.rollId = null;
            }
            return next;
          }),
        );
        setUnknownColorRows((s) => {
          const next = new Set(s);
          if (result.colorName) next.delete(index);
          else next.add(index);
          return next;
        });
      }

      setColorWarning(result.colorWarning ?? "");
      if (result.grams !== null) setAccuracyNote(result.note ?? "");
      if (result.printHours !== null) setPrintHours(String(Math.round(result.printHours * 100) / 100));
      if (result.thumbnailDataUrl) {
        setModelPreviews((p) => ({ ...p, [index]: { dataUrl: result.thumbnailDataUrl!, fileName: file.name } }));
      }
      setRowStatus((s) => ({
        ...s,
        [index]: {
          kind: result.grams !== null ? "ok" : "error",
          message:
            result.filaments && result.filaments.length > 1
              ? `Split into ${result.filaments.length} colors from ${file.name}.`
              : result.grams !== null
                ? `Read ${Math.round(result.grams * 100) / 100}g from ${file.name}.`
                : (result.note ?? "Couldn't read grams from that file — enter manually."),
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't read that file. Please enter grams manually.";
      console.error("Model file parse failed:", err);
      setRowStatus((s) => ({ ...s, [index]: { kind: "error", message } }));
    } finally {
      setParsingIndex(null);
    }
  }

  async function handleAddRoll(index: number) {
    if (!user) return;
    const usage = colorsUsed[index];
    setSavingRoll(true);
    setError("");
    try {
      const rollId = await addRoll(user.uid, {
        brand: newRoll.brand,
        material: usage.material,
        color: usage.color,
        sizeGrams: newRoll.sizeGrams,
        price: newRoll.price,
        level: newRoll.level,
        quantity: newRoll.level === "full" ? Math.max(1, newRoll.quantity) : 1,
        excludeFromReorder: false,
      });
      updateColorUsage(index, { rollId });
      setAddingRollIndex(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that roll. Please try again.");
    } finally {
      setSavingRoll(false);
    }
  }

  function handlePullFromProject(projectId: string) {
    setPullFromProjectId(projectId);
    if (!projectId) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    setLinkedProjectId(project.id);
    if (!name.trim()) setName(project.name);
    if (project.colorsNeeded.length > 0) {
      setColorsUsed(
        project.colorsNeeded.map((need) => ({
          material: need.material,
          color: need.color,
          grams: need.gramsNeeded ?? 0,
          rollId: need.rollIds[0] ?? null,
        })),
      );
    }
  }

  const appliedInitialProject = useRef(false);
  useEffect(() => {
    if (!initialProjectId || estimate || appliedInitialProject.current) return;
    if (projects.length === 0) return;
    appliedInitialProject.current = true;
    // One-time prefill from a "?projectId=" link, guarded by the ref above — not a sync loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    handlePullFromProject(initialProjectId);
  }, [initialProjectId, projects, estimate]);

  const breakdown = useMemo(
    () => calcCostBreakdown(colorsUsed, rollsById, Number(printHours) || 0, quantity, settings),
    [colorsUsed, rollsById, printHours, quantity, settings],
  );

  const channelPrices = useMemo(
    () => settings.channels.map((c) => ({ channel: c, price: calcSuggestedPrice(breakdown.costPerUnit, settings.targetProfitPercent, c) })),
    [settings, breakdown],
  );

  const selectedChannel = settings.channels.find((c) => c.id === channelId) ?? settings.channels[0];
  const suggestedPrice = selectedChannel ? calcSuggestedPrice(breakdown.costPerUnit, settings.targetProfitPercent, selectedChannel) : 0;

  async function handleSaveSettings() {
    if (!user) return;
    setSavingSettings(true);
    try {
      await saveEstimatorSettings(user.uid, settings);
      setEditingSettings(false);
    } finally {
      setSavingSettings(false);
    }
  }

  function updateChannel(id: SalesChannelId, patch: Partial<typeof settings.channels[number]>) {
    setSettings((s) => ({
      ...s,
      channels: s.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setNotice("");
    if (!name.trim()) {
      setError("Give this estimate a name.");
      return;
    }
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        colorsUsed,
        printHours: Number(printHours) || 0,
        quantity: Math.max(1, quantity),
        channelId,
        projectId: linkedProjectId,
      };
      if (estimate) {
        await updateEstimate(estimate.id, input);
      } else {
        const id = await addEstimate(user.uid, input);
        router.push(`/estimator/${id}/edit`);
        return;
      }
      setNotice("Estimate saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong saving this estimate. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAsProject() {
    if (!user) return;
    setError("");
    setNotice("");
    setSavingProject(true);
    try {
      let estimateId = estimate?.id ?? null;
      const input = {
        name: name.trim() || "Untitled estimate",
        colorsUsed,
        printHours: Number(printHours) || 0,
        quantity: Math.max(1, quantity),
        channelId,
        projectId: linkedProjectId,
      };
      if (!estimateId) {
        estimateId = await addEstimate(user.uid, input);
      } else {
        await updateEstimate(estimateId, input);
      }

      const projectInput = {
        name: name.trim() || "Untitled project",
        status: "Active" as const,
        colorsNeeded: colorsUsed.map((c) => ({
          material: c.material,
          color: c.color,
          gramsNeeded: c.grams || null,
          rollIds: c.rollId ? [c.rollId] : [],
        })),
        estimateId,
      };

      let finalProjectId = linkedProjectId;
      if (linkedProjectId) {
        await updateProject(linkedProjectId, projectInput);
      } else {
        finalProjectId = await addProject(user.uid, projectInput);
        setLinkedProjectId(finalProjectId);
        await updateEstimate(estimateId, { ...input, projectId: finalProjectId });
      }

      if (finalProjectId) {
        for (const preview of Object.values(modelPreviews)) {
          const imageFile = await dataUrlToFile(preview.dataUrl, `${preview.fileName}-preview.png`);
          await uploadProjectFile(user.uid, finalProjectId, imageFile, "image");
        }
        setModelPreviews({});
      }

      setNotice(linkedProjectId ? "Project updated with this estimate." : "Saved as a new project.");
      if (!estimate) router.push(`/estimator/${estimateId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save as a project. Please try again.");
    } finally {
      setSavingProject(false);
    }
  }

  const linkedProject = projects.find((p) => p.id === linkedProjectId);
  const isDirty =
    name !== initial.name ||
    JSON.stringify(colorsUsed) !== initial.colorsUsedJson ||
    printHours !== initial.printHours ||
    quantity !== initial.quantity;

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="flex justify-end">
        <CloseLink href="/estimator" dirty={isDirty} />
      </div>

      {colorWarning && (
        <p className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          ⚠ {colorWarning}
        </p>
      )}
      {accuracyNote && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          {accuracyNote}
        </p>
      )}

      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Estimate name
        </label>
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Hex planter batch"
          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
        />
      </div>

      {linkedProject ? (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
          Linked to project &ldquo;{linkedProject.name}&rdquo;.
        </p>
      ) : (
        !estimate && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Pull in from an existing project <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <select
              value={pullFromProjectId}
              onChange={(e) => handlePullFromProject(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            >
              <option value="">Start a new estimate</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Colors needed</label>
          <button
            type="button"
            onClick={addColorUsageRow}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            <PlusIcon />
            Add color
          </button>
        </div>

        <div className="space-y-3">
          {colorsUsed.map((usage, index) => {
            const matches = rolls.filter((r) => r.material === usage.material && r.color === usage.color);
            return (
              <div
                key={index}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[0.02]"
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                  <ComboSelect
                    label="Material"
                    value={usage.material}
                    onChange={(v) => updateColorUsage(index, { material: v, rollId: null })}
                    options={MATERIAL_OPTIONS}
                    customPlaceholder="e.g. HIPS"
                  />
                  <div className={unknownColorRows.has(index) ? "rounded-xl ring-2 ring-rose-400" : ""}>
                    <ComboSelect
                      label="Color"
                      value={usage.color}
                      onChange={(v) => {
                        updateColorUsage(index, { color: v, rollId: null });
                        clearUnknownColor(index);
                      }}
                      options={COLOR_OPTIONS}
                      customPlaceholder="e.g. Galaxy Purple"
                    />
                    {unknownColorRows.has(index) && (
                      <p className="mt-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                        Not read from the file — pick the real color
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Grams</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={usage.grams}
                      onChange={(e) => updateColorUsage(index, { grams: Number(e.target.value), gramsSource: undefined })}
                      className="h-12 w-24 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                    />
                  </div>
                  {colorsUsed.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeColorUsageRow(index)}
                      aria-label="Remove color"
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 text-rose-600 transition-colors hover:bg-rose-50 dark:border-white/10 dark:text-rose-400 dark:hover:bg-rose-500/10"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
                    <UploadIcon />
                    {parsingIndex === index ? "Reading file…" : "Upload STL / 3MF / G-code"}
                    <input
                      type="file"
                      accept=".stl,.3mf,.gcode,.gco"
                      className="hidden"
                      disabled={parsingIndex !== null}
                      onChange={(e) => {
                        void handleFileUpload(index, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {usage.gramsSource === "estimated" && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      Estimated from model
                    </span>
                  )}
                  {usage.gramsSource === "exact" && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      Exact from slicer
                    </span>
                  )}
                </div>

                {rowStatus[index] && (
                  <p
                    className={`mt-1.5 text-xs ${
                      rowStatus[index].kind === "error"
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {rowStatus[index].message}
                  </p>
                )}

                {modelPreviews[index] && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={modelPreviews[index].dataUrl}
                      alt={modelPreviews[index].fileName}
                      className="h-16 w-20 rounded-lg border border-slate-200 object-cover dark:border-white/10"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Preview from {modelPreviews[index].fileName} — will be added as a project photo when you save as a
                      project.
                    </span>
                  </div>
                )}

                <div className="mt-3">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Roll to cost this from
                  </label>
                  {matches.length === 0 ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                      No matching roll in inventory — filament cost for this color will use a default of{" "}
                      {money(DEFAULT_ROLL_PRICE)}/roll until you add one or pick another match.
                    </p>
                  ) : (
                    <select
                      value={usage.rollId ?? ""}
                      onChange={(e) => updateColorUsage(index, { rollId: e.target.value || null })}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                    >
                      <option value="">Don&rsquo;t cost this color yet</option>
                      {matches.map((roll) => (
                        <option key={roll.id} value={roll.id}>
                          {roll.brand} — {money(costPerGram(roll))}/g ({Math.round(roll.remainingGrams)}g on hand)
                        </option>
                      ))}
                    </select>
                  )}

                  {addingRollIndex === index ? (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        New {usage.material} / {usage.color} roll
                      </p>
                      <div className="grid gap-2 sm:grid-cols-5">
                        <ComboSelect
                          label="Brand"
                          value={newRoll.brand}
                          onChange={(v) => setNewRoll((r) => ({ ...r, brand: v }))}
                          options={BRAND_OPTIONS}
                          customPlaceholder="e.g. Polymaker"
                        />
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Size (g)
                          </label>
                          <select
                            value={newRoll.sizeGrams}
                            onChange={(e) => setNewRoll((r) => ({ ...r, sizeGrams: Number(e.target.value) }))}
                            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                          >
                            {SIZE_OPTIONS_GRAMS.map((g) => (
                              <option key={g} value={g}>
                                {g}g
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            On hand
                          </label>
                          <select
                            value={newRoll.level}
                            onChange={(e) => setNewRoll((r) => ({ ...r, level: e.target.value as RollLevel }))}
                            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                          >
                            {ROLL_LEVELS.map((l) => (
                              <option key={l} value={l}>
                                {l === "empty" ? "Don't have it yet (0g)" : ROLL_LEVEL_LABELS[l]}
                              </option>
                            ))}
                          </select>
                        </div>
                        {newRoll.level === "full" && (
                          <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                              Quantity
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={newRoll.quantity}
                              onChange={(e) => setNewRoll((r) => ({ ...r, quantity: Math.max(1, Number(e.target.value)) }))}
                              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                            />
                          </div>
                        )}
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Price ($)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={newRoll.price}
                            onChange={(e) => setNewRoll((r) => ({ ...r, price: Number(e.target.value) }))}
                            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                          />
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        No price yet? The cost estimate will use a default of {money(DEFAULT_ROLL_PRICE)}/roll until you set
                        a real one.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={savingRoll}
                          onClick={() => handleAddRoll(index)}
                          className="h-9 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {savingRoll ? "Adding…" : "Add roll to inventory"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingRollIndex(null)}
                          className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingRollIndex(index)}
                      className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <PlusIcon />
                      Add a new roll for this color
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="printHours" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Print time (hours)
          </label>
          <input
            id="printHours"
            type="number"
            min={0}
            step="0.1"
            value={printHours}
            onChange={(e) => setPrintHours(e.target.value)}
            placeholder="3.5"
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
          />
        </div>
        <div>
          <label htmlFor="quantity" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Units per batch
          </label>
          <input
            id="quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cost breakdown (per unit)</p>
          <button
            type="button"
            onClick={() => setEditingSettings((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <GearIcon />
            Rates &amp; fees
          </button>
        </div>

        {editingSettings && (
          <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3 dark:border-white/10 dark:bg-white/[0.03]">
            {(
              [
                ["machineRatePerHour", "Machine rate ($/hr)"],
                ["electricityRatePerHour", "Electricity ($/hr)"],
                ["laborRatePerHour", "Labor rate ($/hr)"],
                ["packagingCost", "Packaging ($)"],
                ["shippingCost", "Shipping ($)"],
                ["failureBufferPercent", "Failure buffer (%)"],
                ["targetProfitPercent", "Target profit (%)"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={settings[key]}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: Number(e.target.value) }))}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
            ))}

            <div className="sm:col-span-3">
              <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Channel fees</p>
              <div className="space-y-2">
                {settings.channels.map((c) => (
                  <div key={c.id} className="grid grid-cols-5 items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{c.label}</span>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={c.percentFee}
                      title="Platform fee %"
                      onChange={(e) => updateChannel(c.id, { percentFee: Number(e.target.value) })}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={c.fixedFee}
                      title="Platform flat fee $"
                      onChange={(e) => updateChannel(c.id, { fixedFee: Number(e.target.value) })}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={c.processingPercent}
                      title="Processing fee %"
                      onChange={(e) => updateChannel(c.id, { processingPercent: Number(e.target.value) })}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={c.processingFixed}
                      title="Processing flat fee $"
                      onChange={(e) => updateChannel(c.id, { processingFixed: Number(e.target.value) })}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                    />
                  </div>
                ))}
                <div className="grid grid-cols-5 gap-2 text-[10px] text-slate-400">
                  <span />
                  <span>% fee</span>
                  <span>$ fee</span>
                  <span>% processing</span>
                  <span>$ processing</span>
                </div>
              </div>
              <button
                type="button"
                disabled={savingSettings}
                onClick={handleSaveSettings}
                className="mt-3 h-9 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70"
              >
                {savingSettings ? "Saving…" : "Save as default rates"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex justify-between">
            <span>Filament</span>
            <span>{money(breakdown.filamentCost / Math.max(1, quantity))}</span>
          </div>
          <div className="flex justify-between">
            <span>Machine time</span>
            <span>{money(breakdown.machineCost / Math.max(1, quantity))}</span>
          </div>
          <div className="flex justify-between">
            <span>Electricity</span>
            <span>{money(breakdown.electricityCost / Math.max(1, quantity))}</span>
          </div>
          <div className="flex justify-between">
            <span>Labor</span>
            <span>{money(breakdown.laborCost / Math.max(1, quantity))}</span>
          </div>
          <div className="flex justify-between">
            <span>Packaging + shipping</span>
            <span>{money((breakdown.packagingCost + breakdown.shippingCost) / Math.max(1, quantity))}</span>
          </div>
          <div className="flex justify-between">
            <span>Failure buffer ({settings.failureBufferPercent}%)</span>
            <span>{money(breakdown.failureBuffer / Math.max(1, quantity))}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900 dark:border-white/10 dark:text-white">
            <span>Cost per unit</span>
            <span>{money(breakdown.costPerUnit)}</span>
          </div>
        </div>

        {breakdown.defaultedColors.length > 0 && (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            ⚠ No roll price for{" "}
            {breakdown.defaultedColors.map((c, i) => (
              <span key={i}>
                {i > 0 && ", "}
                <span className="font-semibold">
                  {c.material} {c.color}
                </span>
              </span>
            ))}{" "}
            — this estimate uses a default of {money(DEFAULT_ROLL_PRICE)}/roll until a real price is set.
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Sales channel</label>
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
          {channelPrices.map(({ channel, price }) => (
            <button
              key={channel.id}
              type="button"
              onClick={() => setChannelId(channel.id)}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                channelId === channel.id
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.06]"
              } ${channel.id !== channelPrices[channelPrices.length - 1].channel.id ? "border-b border-slate-100 dark:border-white/10" : ""}`}
            >
              <span>{channel.label}</span>
              <span className="font-semibold">{Number.isFinite(price) ? money(price) : "—"}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          Suggested price via {selectedChannel?.label}: {Number.isFinite(suggestedPrice) ? money(suggestedPrice) : "—"} / unit
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex h-12 flex-1 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-lg shadow-blue-950/15 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? "Saving…" : estimate ? "Save changes" : "Save estimate"}
        </button>
        <button
          type="button"
          disabled={savingProject}
          onClick={handleSaveAsProject}
          className="flex h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
        >
          {savingProject ? "Saving…" : linkedProjectId ? "Update linked project" : "Save as new project"}
        </button>
      </div>
    </form>
  );
}
