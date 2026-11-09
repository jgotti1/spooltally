"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ComboSelect } from "@/components/ComboSelect";
import { CloseLink } from "@/components/CloseLink";
import { parseModelFile, dataUrlToFile } from "@/lib/model-parsing";
import {
  BRAND_OPTIONS,
  COLOR_OPTIONS,
  MATERIAL_OPTIONS,
  PROJECT_STATUSES,
  SIZE_OPTIONS_GRAMS,
  type ProjectStatus,
} from "@/lib/inventory-constants";
import { addPlaceholderRoll, subscribeToRolls, type Roll } from "@/lib/rolls";
import {
  addProject,
  deleteProjectFile,
  updateProject,
  uploadProjectFile,
  type Project,
  type ProjectColorNeed,
  type ProjectFile,
} from "@/lib/projects";

type ProjectFormProps = {
  project?: Project;
};

function emptyColorNeed(): ProjectColorNeed {
  return { material: MATERIAL_OPTIONS[0], color: COLOR_OPTIONS[0], gramsNeeded: null, rollIds: [] };
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

function CameraIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M3 7.5a1.5 1.5 0 0 1 1.5-1.5h1l.8-1.3a1 1 0 0 1 .85-.7h3.7a1 1 0 0 1 .85.7L12.5 6h1A1.5 1.5 0 0 1 15 7.5v6A1.5 1.5 0 0 1 13.5 15h-9A1.5 1.5 0 0 1 3 13.5v-6Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="9" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
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

function FileIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M5.5 3h5.5L14 5.5V16a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5V3.5a.5.5 0 0 1 .5-.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M11 3v2.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/** Add/edit form for a project: name, status, colors needed (linked to inventory rolls), and file/photo uploads. */
export function ProjectForm({ project }: ProjectFormProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(project?.name ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "Active");
  const [colorsNeeded, setColorsNeeded] = useState<ProjectColorNeed[]>(
    project?.colorsNeeded && project.colorsNeeded.length > 0 ? project.colorsNeeded : [emptyColorNeed()],
  );
  const [files, setFiles] = useState<ProjectFile[]>(project?.files ?? []);
  const [existingRolls, setExistingRolls] = useState<Roll[]>([]);

  const [initial] = useState(() => ({
    name: project?.name ?? "",
    status: project?.status ?? "Active",
    colorsNeededJson: JSON.stringify(
      project?.colorsNeeded && project.colorsNeeded.length > 0 ? project.colorsNeeded : [emptyColorNeed()],
    ),
  }));

  const isDirty = name !== initial.name || status !== initial.status || JSON.stringify(colorsNeeded) !== initial.colorsNeededJson;
  const [placeholderDraft, setPlaceholderDraft] = useState<Record<number, { brand: string; sizeGrams: number }>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"model" | "image" | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [error, setError] = useState("");
  const modelInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [startMode, setStartMode] = useState<"choose" | "manual">(project ? "manual" : "choose");
  const [parsingNew, setParsingNew] = useState(false);
  const [pendingModelFile, setPendingModelFile] = useState<File | null>(null);
  const [pendingThumbnail, setPendingThumbnail] = useState<string | null>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToRolls(user.uid, setExistingRolls);
  }, [user]);

  function updateColorNeed(index: number, patch: Partial<ProjectColorNeed>) {
    setColorsNeeded((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addColorNeedRow() {
    setColorsNeeded((rows) => [...rows, emptyColorNeed()]);
  }

  function removeColorNeedRow(index: number) {
    setColorsNeeded((rows) => rows.filter((_, i) => i !== index));
  }

  function toggleRollLink(index: number, rollId: string) {
    setColorsNeeded((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;
        const rollIds = row.rollIds.includes(rollId)
          ? row.rollIds.filter((id) => id !== rollId)
          : [...row.rollIds, rollId];
        return { ...row, rollIds };
      }),
    );
  }

  async function handleAddPlaceholder(index: number) {
    if (!user) return;
    const need = colorsNeeded[index];
    const draft = placeholderDraft[index] ?? { brand: BRAND_OPTIONS[0], sizeGrams: 1000 };
    try {
      const rollId = await addPlaceholderRoll(user.uid, {
        brand: draft.brand,
        material: need.material,
        color: need.color,
        sizeGrams: draft.sizeGrams,
      });
      setExistingRolls((rolls) => [
        ...rolls,
        {
          id: rollId,
          ownerId: user.uid,
          brand: draft.brand,
          material: need.material,
          color: need.color,
          sizeGrams: draft.sizeGrams,
          price: 0,
          level: "empty",
          quantity: 1,
          remainingGrams: 0,
          excludeFromReorder: false,
          createdAt: null,
          updatedAt: null,
        },
      ]);
      toggleRollLink(index, rollId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that color to inventory. Please try again.");
    }
  }

  async function handleChooseUpload(file: File | undefined) {
    if (!file) return;
    setParsingNew(true);
    setError("");
    try {
      const material = colorsNeeded[0]?.material ?? MATERIAL_OPTIONS[0];
      const result = await parseModelFile(file, material);
      if (result.filaments && result.filaments.length > 1) {
        setColorsNeeded(
          result.filaments.map((f) => ({
            material,
            color: f.colorName ?? COLOR_OPTIONS[0],
            gramsNeeded: Math.round(f.grams * 100) / 100,
            gramsSource: result.accuracy,
            rollIds: [],
          })),
        );
      } else if (result.grams !== null || result.colorName) {
        setColorsNeeded((rows) =>
          rows.map((row, i) =>
            i === 0
              ? {
                  ...row,
                  ...(result.grams !== null
                    ? { gramsNeeded: Math.round(result.grams! * 100) / 100, gramsSource: result.accuracy }
                    : {}),
                  ...(result.colorName && result.colorName !== row.color
                    ? { color: result.colorName, rollIds: [] }
                    : {}),
                }
              : row,
          ),
        );
      }
      if (!name.trim()) setName(file.name.replace(/\.(stl|3mf|gcode|gco)$/i, ""));
      setPendingModelFile(file);
      if (result.thumbnailDataUrl) setPendingThumbnail(result.thumbnailDataUrl);
      if (result.grams === null) {
        setError(result.note ?? "Couldn't read a filament weight from that file — fill it in below.");
      }
    } catch (err) {
      setPendingModelFile(file);
      setError(err instanceof Error ? err.message : "Couldn't read that file — fill in the details below.");
    } finally {
      setParsingNew(false);
      setStartMode("manual");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    if (!name.trim()) {
      setError("Give this project a name.");
      return;
    }
    setSaving(true);
    try {
      const input = { name: name.trim(), status, colorsNeeded };
      if (project) {
        await updateProject(project.id, input);
        router.push("/projects");
      } else {
        const id = await addProject(user.uid, input);
        if (pendingModelFile) await uploadProjectFile(user.uid, id, pendingModelFile, "model");
        if (pendingThumbnail) {
          const imageFile = await dataUrlToFile(pendingThumbnail, `${pendingModelFile?.name ?? "model"}-preview.png`);
          await uploadProjectFile(user.uid, id, imageFile, "image");
        }
        router.push(`/projects/${id}/edit`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong saving this project. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(fileList: FileList | null, type: "model" | "image") {
    if (!user || !project || !fileList || fileList.length === 0) return;
    const file = fileList[0];
    setUploading(type);
    setError("");
    setUploadStatus(null);
    try {
      const meta = await uploadProjectFile(user.uid, project.id, file, type);
      setFiles((prev) => [...prev, meta]);

      if (type === "model") {
        try {
          const material = colorsNeeded[0]?.material ?? MATERIAL_OPTIONS[0];
          const result = await parseModelFile(file, material);
          if (result.filaments && result.filaments.length > 1) {
            setColorsNeeded((rows) => {
              const next = [...rows];
              for (const f of result.filaments!) {
                const color = f.colorName ?? COLOR_OPTIONS[0];
                const existingIndex = next.findIndex((r) => r.material === material && r.color === color);
                if (existingIndex >= 0 && next[existingIndex].gramsNeeded === null) {
                  next[existingIndex] = {
                    ...next[existingIndex],
                    gramsNeeded: Math.round(f.grams * 100) / 100,
                    gramsSource: result.accuracy,
                  };
                } else if (existingIndex < 0) {
                  next.push({
                    material,
                    color,
                    gramsNeeded: Math.round(f.grams * 100) / 100,
                    gramsSource: result.accuracy,
                    rollIds: [],
                  });
                }
              }
              const isUntouchedDefault = (r: ProjectColorNeed) =>
                r.material === MATERIAL_OPTIONS[0] && r.color === COLOR_OPTIONS[0] && r.gramsNeeded === null && r.rollIds.length === 0;
              return next.length > 1 ? next.filter((r, i) => !(i === 0 && isUntouchedDefault(r))) : next;
            });
          } else if (result.grams !== null || result.colorName) {
            setColorsNeeded((rows) =>
              rows.map((row, i) =>
                i === 0
                  ? {
                      ...row,
                      ...(result.grams !== null && row.gramsNeeded === null
                        ? { gramsNeeded: Math.round(result.grams! * 100) / 100, gramsSource: result.accuracy }
                        : {}),
                      ...(result.colorName && result.colorName !== row.color
                        ? { color: result.colorName, rollIds: [] }
                        : {}),
                    }
                  : row,
              ),
            );
          }
          if (result.thumbnailDataUrl) {
            const res = await fetch(result.thumbnailDataUrl);
            const blob = await res.blob();
            const imageFile = new File([blob], `${file.name}-preview.png`, { type: blob.type });
            const imageMeta = await uploadProjectFile(user.uid, project.id, imageFile, "image");
            setFiles((prev) => [...prev, imageMeta]);
          }
          setUploadStatus({
            kind: result.grams !== null ? "ok" : "error",
            message:
              result.filaments && result.filaments.length > 1
                ? `Split into ${result.filaments.length} colors from ${file.name}.`
                : result.grams !== null
                  ? `Filled grams needed for the first color from ${file.name}.`
                  : (result.note ?? "Uploaded, but couldn't read a filament weight from this file."),
          });
        } catch (parseErr) {
          console.error("Model file parse failed:", parseErr);
          setUploadStatus({ kind: "error", message: "File uploaded, but couldn't read grams or a thumbnail from it." });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that file. Please try again.");
    } finally {
      setUploading(null);
      if (modelInputRef.current) modelInputRef.current.value = "";
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function handleDeleteFile(file: ProjectFile) {
    if (!project) return;
    try {
      await deleteProjectFile(project.id, file);
      setFiles((prev) => prev.filter((f) => f.path !== file.path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that file. Please try again.");
    }
  }

  if (startMode === "choose") {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <CloseLink href="/projects" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">How do you want to start?</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Upload a model file to pull in filament needed and a preview photo automatically, or start from a blank form.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            ref={newFileInputRef}
            type="file"
            accept=".stl,.3mf,.gcode,.gco"
            className="hidden"
            disabled={parsingNew}
            onChange={(e) => {
              void handleChooseUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={parsingNew}
            onClick={() => newFileInputRef.current?.click()}
            className="flex flex-col items-start gap-2 rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 text-left transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-blue-500/30 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
          >
            <FileIcon />
            <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              {parsingNew ? "Reading file…" : "Upload a file"}
            </span>
            <span className="text-xs text-blue-700/80 dark:text-blue-300/80">STL / 3MF / G-code — import filament needed</span>
          </button>

          <button
            type="button"
            onClick={() => setStartMode("manual")}
            className="flex flex-col items-start gap-2 rounded-2xl border-2 border-slate-200 bg-white p-5 text-left transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
          >
            <PlusIcon />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Enter manually</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Start from a blank form</span>
          </button>
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="flex justify-end">
        <CloseLink href="/projects" dirty={isDirty} />
      </div>
      {pendingModelFile && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-500/30 dark:bg-blue-500/10">
          {pendingThumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pendingThumbnail} alt={pendingModelFile.name} className="h-12 w-16 rounded-lg object-cover" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-blue-600 dark:bg-white/10">
              <FileIcon />
            </span>
          )}
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <span className="font-semibold">{pendingModelFile.name}</span> will be attached once you save this project.
          </p>
        </div>
      )}
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Project name
        </label>
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Hex planters — craft fair batch"
          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Status</label>
        <div className="grid grid-cols-3 gap-2">
          {PROJECT_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`h-11 rounded-xl text-sm font-semibold transition-colors ${
                status === s
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Colors needed</label>
          <button
            type="button"
            onClick={addColorNeedRow}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            <PlusIcon />
            Add color
          </button>
        </div>

        <div className="space-y-4">
          {colorsNeeded.map((need, index) => {
            const matches = existingRolls.filter((r) => r.material === need.material && r.color === need.color);
            const draft = placeholderDraft[index] ?? { brand: BRAND_OPTIONS[0], sizeGrams: 1000 };
            return (
              <div
                key={index}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[0.02]"
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                  <ComboSelect
                    label="Material"
                    value={need.material}
                    onChange={(v) => updateColorNeed(index, { material: v })}
                    options={MATERIAL_OPTIONS}
                    customPlaceholder="e.g. HIPS"
                  />
                  <ComboSelect
                    label="Color"
                    value={need.color}
                    onChange={(v) => updateColorNeed(index, { color: v })}
                    options={COLOR_OPTIONS}
                    customPlaceholder="e.g. Galaxy Purple"
                  />
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Grams needed <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={need.gramsNeeded ?? ""}
                      onChange={(e) =>
                        updateColorNeed(index, {
                          gramsNeeded: e.target.value === "" ? null : Number(e.target.value),
                          gramsSource: undefined,
                        })
                      }
                      placeholder="Not sure yet"
                      className="h-12 w-28 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 placeholder:text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
                    />
                    {need.gramsSource === "estimated" && (
                      <p className="mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">Estimated from model</p>
                    )}
                    {need.gramsSource === "exact" && (
                      <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Exact from slicer</p>
                    )}
                  </div>
                  {colorsNeeded.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeColorNeedRow(index)}
                      aria-label="Remove color"
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 text-rose-600 transition-colors hover:bg-rose-50 dark:border-white/10 dark:text-rose-400 dark:hover:bg-rose-500/10"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>

                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Rolls to use for this color
                  </p>
                  {matches.length === 0 ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
                      <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                        Not in your inventory — order soon
                      </p>
                      <p className="mt-1 text-xs text-rose-600/90 dark:text-rose-300/80">
                        Add it to your spool list with 0 in stock so it shows up on the reorder report.
                      </p>
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <select
                          value={draft.brand}
                          onChange={(e) =>
                            setPlaceholderDraft((d) => ({ ...d, [index]: { ...draft, brand: e.target.value } }))
                          }
                          className="h-9 rounded-lg border border-rose-200 bg-white px-2 text-xs text-slate-950 dark:border-rose-500/30 dark:bg-white/[0.03] dark:text-white"
                        >
                          {BRAND_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                        <select
                          value={draft.sizeGrams}
                          onChange={(e) =>
                            setPlaceholderDraft((d) => ({ ...d, [index]: { ...draft, sizeGrams: Number(e.target.value) } }))
                          }
                          className="h-9 rounded-lg border border-rose-200 bg-white px-2 text-xs text-slate-950 dark:border-rose-500/30 dark:bg-white/[0.03] dark:text-white"
                        >
                          {SIZE_OPTIONS_GRAMS.map((g) => (
                            <option key={g} value={g}>
                              {g} g
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleAddPlaceholder(index)}
                          className="h-9 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-rose-700"
                        >
                          Add to inventory (0 in stock)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {matches.map((roll) => (
                        <label
                          key={roll.id}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.03]"
                        >
                          <input
                            type="checkbox"
                            checked={need.rollIds.includes(roll.id)}
                            onChange={() => toggleRollLink(index, roll.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/20"
                          />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{roll.brand}</span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {Math.round(roll.remainingGrams)} g on hand
                            {roll.remainingGrams === 0 ? " — needs reorder" : ""}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {project && !project.estimateId && (
        <Link
          href={`/estimator/new?projectId=${project.id}`}
          className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
        >
          Get a cost &amp; price estimate for this project
          <span aria-hidden="true">→</span>
        </Link>
      )}

      {project && (
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Files &amp; photos
          </label>
          <div className="flex flex-wrap gap-3">
            <input
              ref={modelInputRef}
              type="file"
              accept=".stl,.3mf,.gcode,.gco"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files, "model")}
            />
            <button
              type="button"
              onClick={() => modelInputRef.current?.click()}
              disabled={uploading !== null}
              className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]"
            >
              <FileIcon />
              {uploading === "model" ? "Uploading…" : "Upload STL / 3MF / G-code"}
            </button>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files, "image")}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploading !== null}
              className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]"
            >
              <CameraIcon />
              {uploading === "image" ? "Uploading…" : "Take / upload photo"}
            </button>
          </div>

          {uploadStatus && (
            <p
              className={`mt-2 text-xs ${
                uploadStatus.kind === "error" ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {uploadStatus.message}
            </p>
          )}

          {files.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {files.map((file) => (
                <li
                  key={file.path}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.03]"
                >
                  {file.type === "image" ? (
                    <a href={file.url} target="_blank" rel="noreferrer" className="block h-9 w-9 shrink-0 overflow-hidden rounded">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                    </a>
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                      <FileIcon />
                    </span>
                  )}
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center gap-1.5 truncate font-medium text-slate-700 hover:underline dark:text-slate-300"
                  >
                    {file.type === "model" && <DownloadIcon />}
                    <span className="truncate">{file.name}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDeleteFile(file)}
                    aria-label="Delete file"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-lg shadow-blue-950/15 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
      >
        {saving ? "Saving…" : project ? "Save changes" : "Create project"}
      </button>
    </form>
  );
}
