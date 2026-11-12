"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
  NOZZLE_SIZE_OPTIONS_MM,
  PROJECT_STATUSES,
  ROLL_LEVELS,
  ROLL_LEVEL_LABELS,
  SIZE_OPTIONS_GRAMS,
  type ProjectStatus,
  type RollLevel,
} from "@/lib/inventory-constants";
import { addRoll, subscribeToRolls, type Roll } from "@/lib/rolls";
import {
  addProject,
  deleteProjectFile,
  visibleProjectFiles,
  updateProject,
  uploadProjectFile,
  type Project,
  type ProjectColorNeed,
  type ProjectFile,
} from "@/lib/projects";
import {
  getEstimatorSettings,
  DEFAULT_ESTIMATOR_SETTINGS,
  type EstimatorSettings,
} from "@/lib/estimator-settings";
import type { SalesChannelId } from "@/lib/estimator-constants";
import { EstimateDisclaimer } from "@/components/EstimateDisclaimer";
import { calcCostBreakdown, calcSuggestedPrice, DEFAULT_ROLL_PRICE, type ColorUsage } from "@/lib/estimator-pricing";

type ProjectFormProps = {
  project?: Project;
};

const ADD_NEW_ROLL_OPTION = "__add_new_roll__";

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
  const [colorsNeeded, setColorsNeeded] = useState<ProjectColorNeed[]>(project?.colorsNeeded ?? []);
  const [nozzleSizeMm, setNozzleSizeMm] = useState<number | null>(project ? (project.nozzleSizeMm ?? null) : 0.4);
  const [files, setFiles] = useState<ProjectFile[]>(project?.files ?? []);
  const [existingRolls, setExistingRolls] = useState<Roll[]>([]);
  const [printHours, setPrintHours] = useState(project ? String(project.printHours) : "");
  const [slicerFilamentCost, setSlicerFilamentCost] = useState(
    project?.slicerFilamentCost ? String(project.slicerFilamentCost) : "",
  );
  const [quantity, setQuantity] = useState(project?.quantity ?? 1);
  const [channelId, setChannelId] = useState<SalesChannelId>(project?.channelId ?? "etsy");
  const [settings, setSettings] = useState<EstimatorSettings>(DEFAULT_ESTIMATOR_SETTINGS);

  const [initial] = useState(() => ({
    name: project?.name ?? "",
    status: project?.status ?? "Active",
    colorsNeededJson: JSON.stringify(project?.colorsNeeded ?? []),
    nozzleSizeMm: project ? (project.nozzleSizeMm ?? null) : 0.4,
    printHours: project ? String(project.printHours) : "",
    slicerFilamentCost: project?.slicerFilamentCost ? String(project.slicerFilamentCost) : "",
    quantity: project?.quantity ?? 1,
    channelId: project?.channelId ?? "etsy",
  }));

  const isDirty =
    name !== initial.name ||
    status !== initial.status ||
    JSON.stringify(colorsNeeded) !== initial.colorsNeededJson ||
    nozzleSizeMm !== initial.nozzleSizeMm ||
    printHours !== initial.printHours ||
    slicerFilamentCost !== initial.slicerFilamentCost ||
    quantity !== initial.quantity ||
    channelId !== initial.channelId;
  const [placeholderDraft, setPlaceholderDraft] = useState<
    Record<number, { brand: string; sizeGrams: number; level: RollLevel; quantity: number; price: number }>
  >({});
  const [addingRoll, setAddingRoll] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"model" | "image" | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [error, setError] = useState("");
  const modelInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [parsingNew, setParsingNew] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [pendingAttachmentType, setPendingAttachmentType] = useState<"model" | "image" | null>(null);
  const [pendingThumbnail, setPendingThumbnail] = useState<string | null>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);

  const STEP_LABELS = [
    "Preview photo",
    "Name & status",
    "Nozzle size",
    "Colors needed",
    "Print time & quantity",
    "Cost & suggested price",
  ];
  const [step, setStep] = useState(0);
  const showStep = (n: number) => project !== undefined || step === n;
  const [nozzleCustom, setNozzleCustom] = useState(
    () => nozzleSizeMm !== null && !NOZZLE_SIZE_OPTIONS_MM.includes(nozzleSizeMm as 0.2),
  );

  useEffect(() => {
    if (!user) return;
    return subscribeToRolls(user.uid, setExistingRolls);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getEstimatorSettings(user.uid).then((next) => {
      if (active) {
        setSettings(next);
        setChannelId((current) =>
          next.channels.some((channel) => channel.id === current) ? current : (next.channels[0]?.id ?? "etsy"),
        );
      }
    });
    return () => {
      active = false;
    };
  }, [user]);

  function updateColorNeed(index: number, patch: Partial<ProjectColorNeed>) {
    setColorsNeeded((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;
        const merged: ProjectColorNeed = { ...row, ...patch };
        // Firestore rejects a literal `undefined` field value — drop it instead of writing it in,
        // since {...row, gramsSource: undefined} otherwise leaves that key explicitly set to undefined.
        if (merged.gramsSource === undefined) delete merged.gramsSource;
        return merged;
      }),
    );
  }

  function addColorNeedRow() {
    setColorsNeeded((rows) => [...rows, emptyColorNeed()]);
  }

  function removeColorNeedRow(index: number) {
    setColorsNeeded((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleAddPlaceholder(index: number) {
    if (!user) return;
    const need = colorsNeeded[index];
    const draft = placeholderDraft[index] ?? { brand: BRAND_OPTIONS[0], sizeGrams: 1000, level: "empty" as RollLevel, quantity: 1, price: 0 };
    try {
      const rollId = await addRoll(user.uid, {
        brand: draft.brand,
        material: need.material,
        color: need.color,
        sizeGrams: draft.sizeGrams,
        price: draft.price,
        level: draft.level,
        quantity: draft.level === "full" ? Math.max(1, draft.quantity) : 1,
        excludeFromReorder: false,
      });
      // The live rolls subscription will pick up the new roll — no optimistic local push, to avoid
      // racing it (Firestore can deliver the subscription update before this await even resolves,
      // which previously caused the same roll to be added to state twice).
      updateColorNeed(index, { rollIds: [rollId] });
      setAddingRoll((rows) => ({ ...rows, [index]: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that color to inventory. Please try again.");
    }
  }

  /** Uploads a model file purely to pull a preview photo out of it (rendered snapshot for STL, embedded thumbnail for 3MF/G-code) — doesn't touch colors needed or grams, since that import turned out too unreliable to trust. */
  async function handlePreviewUpload(file: File | undefined) {
    if (!file) return;
    setParsingNew(true);
    setError("");
    try {
      if (file.type.startsWith("image/")) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Couldn't read that image."));
          reader.readAsDataURL(file);
        });
        setPendingAttachment(file);
        setPendingAttachmentType("image");
        setPendingThumbnail(dataUrl);
      } else {
        const result = await parseModelFile(file, MATERIAL_OPTIONS[0]);
        if (!name.trim()) setName(file.name.replace(/\.(stl|3mf|gcode|gco)$/i, ""));
        setPendingAttachment(file);
        setPendingAttachmentType("model");
        if (result.thumbnailDataUrl) {
          setPendingThumbnail(result.thumbnailDataUrl);
        } else {
          setError("Uploaded, but couldn't generate a preview image from this file.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setParsingNew(false);
    }
  }

  function goNext() {
    setError("");
    if (step === 1 && !name.trim()) {
      setError("Give this project a name.");
      return;
    }
    if (step === 2 && nozzleSizeMm === null) {
      setError("Enter a nozzle size — check your slicer for the one you used.");
      return;
    }
    if (step === 3) {
      if (colorsNeeded.length === 0) {
        setError("Add at least one color before continuing.");
        return;
      }
      if (colorsNeeded.some((color) => color.rollIds.length === 0)) {
        setError("Select an inventory roll, or add a new roll, for every color before continuing.");
        return;
      }
    }
    if (step === 4 && !printHours.trim()) {
      setError("Enter the print time — check your slicer for the exact number.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function goBack() {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    if (!name.trim()) {
      setError("Give this project a name.");
      return;
    }
    if (colorsNeeded.some((color) => color.rollIds.length === 0)) {
      setError("Select an inventory roll, or add a new roll, for every color before saving.");
      return;
    }
    if (!project) {
      const missing: string[] = [];
      if (nozzleSizeMm === null) missing.push("a nozzle size");
      if (colorsNeeded.length === 0) missing.push("at least one color");
      else if (!printHours.trim()) missing.push("the print time");
      if (missing.length > 0) {
        setError(`Add ${missing.join(", ")} before creating this project — check your slicer for the exact numbers.`);
        return;
      }
    }
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        status,
        colorsNeeded,
        nozzleSizeMm,
        printHours: Number(printHours) || 0,
        quantity: Math.max(1, quantity),
        channelId,
        slicerFilamentCost: slicerFilamentCost.trim() ? Number(slicerFilamentCost) : null,
      };
      const id = project ? project.id : await addProject(user.uid, input);
      if (project) await updateProject(project.id, input);
      // The preview picked at the top of the form is attached on save, for new and existing projects alike.
      if (pendingAttachment && pendingAttachmentType) {
        await uploadProjectFile(user.uid, id, pendingAttachment, pendingAttachmentType);
        if (pendingAttachmentType === "model" && pendingThumbnail) {
          const imageFile = await dataUrlToFile(pendingThumbnail, `${pendingAttachment.name}-preview.png`);
          await uploadProjectFile(user.uid, id, imageFile, "image", pendingAttachment.name);
        }
      }
      if (project) {
        router.push("/projects");
      } else {
        router.replace(`/projects/${id}/edit`);
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
          const result = await parseModelFile(file, MATERIAL_OPTIONS[0]);
          if (result.thumbnailDataUrl) {
            const res = await fetch(result.thumbnailDataUrl);
            const blob = await res.blob();
            const imageFile = new File([blob], `${file.name}-preview.png`, { type: blob.type });
            const imageMeta = await uploadProjectFile(user.uid, project.id, imageFile, "image", file.name);
            setFiles((prev) => [...prev, imageMeta]);
            setUploadStatus({ kind: "ok", message: `Added a preview photo from ${file.name}.` });
          } else {
            setUploadStatus({ kind: "error", message: "Uploaded, but couldn't generate a preview image from this file." });
          }
        } catch (parseErr) {
          console.error("Model file preview extraction failed:", parseErr);
          setUploadStatus({ kind: "error", message: "File uploaded, but couldn't generate a preview image from it." });
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
      const filesToDelete =
        file.type === "model"
          ? [
              file,
              ...files.filter(
                (candidate) =>
                  candidate.type === "image" &&
                  (candidate.generatedPreviewFor === file.name || candidate.name === `${file.name}-preview.png`),
              ),
            ]
          : [file];
      for (const projectFile of filesToDelete) {
        await deleteProjectFile(project.id, projectFile);
      }
      const deletedPaths = new Set(filesToDelete.map((projectFile) => projectFile.path));
      setFiles((prev) => prev.filter((projectFile) => !deletedPaths.has(projectFile.path)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that file. Please try again.");
    }
  }

  const rollsById = useMemo(() => new Map(existingRolls.map((r) => [r.id, r])), [existingRolls]);
  const colorUsage: ColorUsage[] = useMemo(
    () =>
      colorsNeeded.map((c) => ({
        material: c.material,
        color: c.color,
        grams: c.gramsNeeded ?? 0,
        rollId: c.rollIds[0] ?? null,
      })),
    [colorsNeeded],
  );
  const breakdown = useMemo(
    () =>
      calcCostBreakdown(
        colorUsage,
        rollsById,
        Number(printHours) || 0,
        quantity,
        settings,
        slicerFilamentCost.trim() ? Number(slicerFilamentCost) : null,
      ),
    [colorUsage, rollsById, printHours, quantity, settings, slicerFilamentCost],
  );
  const channelPrices = useMemo(
    () =>
      settings.channels.map((c) => ({
        channel: c,
        price: calcSuggestedPrice(breakdown.costPerUnit, settings.targetProfitPercent, c),
      })),
    [settings, breakdown],
  );
  const selectedChannel = settings.channels.find((c) => c.id === channelId) ?? settings.channels[0];
  const suggestedPrice = selectedChannel
    ? calcSuggestedPrice(breakdown.costPerUnit, settings.targetProfitPercent, selectedChannel)
    : 0;
  const money = (n: number) => `$${n.toFixed(2)}`;
  const units = Math.max(1, quantity);
  const displayedFiles = visibleProjectFiles(files);
  const everyColorHasRoll = colorsNeeded.every((color) => color.rollIds.length > 0);
  const canSubmit = project
    ? everyColorHasRoll
    : nozzleSizeMm !== null && colorsNeeded.length > 0 && everyColorHasRoll && printHours.trim() !== "";

  return (
    <form className="space-y-6" autoComplete="off" onSubmit={handleSubmit}>
      <div className="flex justify-end">
        <CloseLink href="/projects" dirty={isDirty} />
      </div>

      {!project && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
            Step {step + 1} of {STEP_LABELS.length} — {STEP_LABELS[step]}
          </p>
          <div className="flex gap-1">
            {STEP_LABELS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-6 rounded-full ${i <= step ? "bg-blue-600" : "bg-slate-200 dark:bg-white/10"}`}
              />
            ))}
          </div>
        </div>
      )}

      {showStep(0) && (
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Preview photo <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
          </label>
          {pendingThumbnail ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.02]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingThumbnail} alt="Preview" className="h-14 w-20 rounded-lg object-cover" />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold">{pendingAttachment?.name}</span> will be attached as this project&rsquo;s photo once
                you save.
              </p>
            </div>
          ) : (
            <>
              <input
                ref={newFileInputRef}
                type="file"
                accept=".stl,.3mf,.gcode,.gco,image/*"
                className="hidden"
                disabled={parsingNew}
                onChange={(e) => {
                  void handlePreviewUpload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={parsingNew}
                onClick={() => newFileInputRef.current?.click()}
                className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]"
              >
                <FileIcon />
                {parsingNew ? "Reading file…" : "Upload a photo or STL / 3MF / G-code for a preview"}
              </button>
            </>
          )}
        </div>
      )}

      {showStep(1) && (
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Project name
          </label>
          <input
            id="name"
            required
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hex planters — craft fair batch"
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
          />
        </div>
      )}

      {showStep(1) && (
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Status</label>
          <div className="grid grid-cols-2 gap-2">
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
      )}

      {showStep(2) && (
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Nozzle size (mm){" "}
            {project && <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>}
          </label>
          <div className="grid grid-cols-5 gap-2">
            {NOZZLE_SIZE_OPTIONS_MM.map((mm) => (
              <button
                key={mm}
                type="button"
                onClick={() => {
                  setNozzleCustom(false);
                  setNozzleSizeMm(mm);
                }}
                className={`h-11 rounded-xl text-sm font-semibold transition-colors ${
                  !nozzleCustom && nozzleSizeMm === mm
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]"
                }`}
              >
                {mm}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setNozzleCustom(true)}
              className={`h-11 rounded-xl text-sm font-semibold transition-colors ${
                nozzleCustom
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]"
              }`}
            >
              Other
            </button>
          </div>
          {nozzleCustom && (
            <input
              id="nozzleSize"
              type="number"
              min={0}
              step="0.1"
              autoFocus
              value={nozzleSizeMm ?? ""}
              onChange={(e) => setNozzleSizeMm(e.target.value === "" ? null : Number(e.target.value))}
              placeholder="e.g. 0.3"
              className="mt-2 h-12 w-32 rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
            />
          )}
          {!project && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Please check your slicer for the exact nozzle size you used.
            </p>
          )}
        </div>
      )}

      {showStep(3) && (
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

        {colorsNeeded.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-white/[0.02] dark:text-slate-400">
            No colors added yet — click &ldquo;Add color&rdquo; for each filament this needs.
          </p>
        )}

        <div className="space-y-4">
          {colorsNeeded.map((need, index) => {
            const draft = placeholderDraft[index] ?? {
              brand: BRAND_OPTIONS[0],
              sizeGrams: 1000,
              level: "empty" as RollLevel,
              quantity: 1,
              price: 0,
            };
            return (
              <div
                key={index}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[0.02]"
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                  <ComboSelect
                    key={`material-${need.rollIds[0] ?? "unlinked"}`}
                    label="Material"
                    value={need.material}
                    onChange={(v) => updateColorNeed(index, { material: v, rollIds: [] })}
                    options={MATERIAL_OPTIONS}
                    customPlaceholder="e.g. HIPS"
                  />
                  <ComboSelect
                    key={`color-${need.rollIds[0] ?? "unlinked"}`}
                    label="Color"
                    value={need.color}
                    onChange={(v) => updateColorNeed(index, { color: v, rollIds: [] })}
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
                  <label
                    htmlFor={`inventory-roll-${index}`}
                    className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400"
                  >
                    Inventory roll <span className="text-rose-600 dark:text-rose-400">(required)</span>
                  </label>
                  <select
                    id={`inventory-roll-${index}`}
                    required
                    aria-invalid={need.rollIds.length === 0}
                    value={addingRoll[index] ? ADD_NEW_ROLL_OPTION : (need.rollIds[0] ?? "")}
                    onChange={(e) => {
                      if (e.target.value === ADD_NEW_ROLL_OPTION) {
                        updateColorNeed(index, { rollIds: [] });
                        setAddingRoll((rows) => ({ ...rows, [index]: true }));
                        return;
                      }
                      setAddingRoll((rows) => ({ ...rows, [index]: false }));
                      if (!e.target.value) {
                        updateColorNeed(index, { rollIds: [] });
                        return;
                      }
                      const roll = existingRolls.find((candidate) => candidate.id === e.target.value);
                      if (roll) {
                        updateColorNeed(index, {
                          material: roll.material,
                          color: roll.color,
                          rollIds: [roll.id],
                        });
                      }
                    }}
                    className={`h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:bg-white/[0.03] dark:text-white ${
                      need.rollIds.length === 0
                        ? "border-rose-300 dark:border-rose-500/50"
                        : "border-slate-200 dark:border-white/10"
                    }`}
                  >
                    <option value="">Select a roll from current inventory</option>
                    {existingRolls.map((roll) => (
                      <option key={roll.id} value={roll.id}>
                        {roll.brand} — {roll.color} {roll.material} — {Math.round(roll.remainingGrams)}g on hand
                      </option>
                    ))}
                    <option value={ADD_NEW_ROLL_OPTION}>＋ Add a new roll</option>
                  </select>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Required: choose a roll already in your inventory, or add a new one for this project.
                  </p>

                  {addingRoll[index] && (
                    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/30 dark:bg-blue-500/10">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                        Add {need.color} {need.material} to inventory
                      </p>
                      <p className="mt-1 text-xs text-blue-600/90 dark:text-blue-300/80">
                        Enter what you have, or leave it at 0g to flag it for reorder. If the price is $0, project
                        pricing uses the {money(DEFAULT_ROLL_PRICE)}/roll default until you enter the real price.
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <select
                          value={draft.brand}
                          onChange={(e) =>
                            setPlaceholderDraft((d) => ({ ...d, [index]: { ...draft, brand: e.target.value } }))
                          }
                          className="h-9 rounded-lg border border-blue-200 bg-white px-2 text-xs text-slate-950 dark:border-blue-500/30 dark:bg-white/[0.03] dark:text-white"
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
                          className="h-9 rounded-lg border border-blue-200 bg-white px-2 text-xs text-slate-950 dark:border-blue-500/30 dark:bg-white/[0.03] dark:text-white"
                        >
                          {SIZE_OPTIONS_GRAMS.map((g) => (
                            <option key={g} value={g}>
                              {g} g
                            </option>
                          ))}
                        </select>
                        <select
                          value={draft.level}
                          title="How much is on the roll"
                          onChange={(e) =>
                            setPlaceholderDraft((d) => ({ ...d, [index]: { ...draft, level: e.target.value as RollLevel } }))
                          }
                          className="h-9 rounded-lg border border-blue-200 bg-white px-2 text-xs text-slate-950 dark:border-blue-500/30 dark:bg-white/[0.03] dark:text-white"
                        >
                          {ROLL_LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {l === "empty" ? "Don't have it yet (0g)" : ROLL_LEVEL_LABELS[l]}
                            </option>
                          ))}
                        </select>
                        {draft.level === "full" && (
                          <input
                            type="number"
                            min={1}
                            value={draft.quantity}
                            title="Quantity"
                            placeholder="Qty"
                            onChange={(e) =>
                              setPlaceholderDraft((d) => ({
                                ...d,
                                [index]: { ...draft, quantity: Math.max(1, Number(e.target.value)) },
                              }))
                            }
                            className="h-9 w-full rounded-lg border border-blue-200 bg-white px-2 text-xs text-slate-950 dark:border-blue-500/30 dark:bg-white/[0.03] dark:text-white"
                          />
                        )}
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={draft.price}
                          title="Price ($)"
                          placeholder="Price $"
                          onChange={(e) =>
                            setPlaceholderDraft((d) => ({ ...d, [index]: { ...draft, price: Number(e.target.value) } }))
                          }
                          className="h-9 w-full rounded-lg border border-blue-200 bg-white px-2 text-xs text-slate-950 dark:border-blue-500/30 dark:bg-white/[0.03] dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddPlaceholder(index)}
                        className="mt-2 h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                      >
                        Add to inventory
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {colorsNeeded.length > 0 && (
          <button
            type="button"
            onClick={addColorNeedRow}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 py-3 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50 dark:border-white/15 dark:text-blue-400 dark:hover:bg-blue-500/10"
          >
            <PlusIcon />
            Add another color
          </button>
        )}
      </div>
      )}

      {showStep(4) && colorsNeeded.length > 0 && (
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
              autoFocus
              value={printHours}
              onChange={(e) => setPrintHours(e.target.value)}
              placeholder="3.5"
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Please check your slicer for the exact print time.
            </p>
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
              onFocus={(e) => e.currentTarget.select()}
              onClick={(e) => e.currentTarget.select()}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            />
          </div>
        </div>
      )}

      {showStep(4) && colorsNeeded.length > 0 && (
        <div>
          <label
            htmlFor="slicerFilamentCost"
            className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Filament cost from your slicer{" "}
            <span className="font-normal text-slate-400 dark:text-slate-500">(optional, total for the batch)</span>
          </label>
          <input
            id="slicerFilamentCost"
            type="number"
            min={0}
            step="0.01"
            value={slicerFilamentCost}
            onChange={(e) => setSlicerFilamentCost(e.target.value)}
            placeholder="e.g. 0.65"
            className="h-12 w-40 rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
          />
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            If your slicer shows a filament cost (for example, Bambu Studio&rsquo;s &ldquo;Cost&rdquo; line), enter it here.
            That value will be used to estimate this project&rsquo;s costs instead of our internal calculation based on
            each roll&rsquo;s purchase price and size. Leave it blank to use the internal roll-price calculation.
          </p>
        </div>
      )}

      {showStep(5) && colorsNeeded.length > 0 && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[0.02]">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cost &amp; suggested price</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Per-unit breakdown for a batch of {units} unit{units === 1 ? "" : "s"}. All money is rounded to the
              nearest cent.
            </p>
            <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start justify-between gap-4">
                <span>Filament ({money(breakdown.filamentCost)} batch ÷ {units})</span>
                <span className="shrink-0 font-medium">{money(breakdown.filamentCost / units)}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span>
                  Machine ({Number(printHours) || 0}h × {money(settings.machineRatePerHour)}/hr = {money(breakdown.machineCost)} batch ÷ {units})
                </span>
                <span className="shrink-0 font-medium">{money(breakdown.machineCost / units)}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span>
                  Electricity ({Number(printHours) || 0}h × {money(settings.electricityRatePerHour)}/hr = {money(breakdown.electricityCost)} batch ÷ {units})
                </span>
                <span className="shrink-0 font-medium">{money(breakdown.electricityCost / units)}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span>
                  Labor ({Number(printHours) || 0}h × {money(settings.laborRatePerHour)}/hr = {money(breakdown.laborCost)} batch ÷ {units})
                </span>
                <span className="shrink-0 font-medium">{money(breakdown.laborCost / units)}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span>Packaging ({money(breakdown.packagingCost)} batch ÷ {units})</span>
                <span className="shrink-0 font-medium">{money(breakdown.packagingCost / units)}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span>Shipping ({money(breakdown.shippingCost)} batch ÷ {units})</span>
                <span className="shrink-0 font-medium">{money(breakdown.shippingCost / units)}</span>
              </div>
              <div className="mt-2 flex items-start justify-between gap-4 border-t border-slate-200 pt-2 dark:border-white/10">
                <span>Subtotal before failure buffer</span>
                <span className="shrink-0 font-medium">{money(breakdown.subtotalCost)}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span>
                  Failure buffer ({settings.failureBufferPercent}% of {money(breakdown.subtotalCost)} = {money(breakdown.failureBuffer)} batch ÷ {units})
                </span>
                <span className="shrink-0 font-medium">{money(breakdown.failureBuffer / units)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-800 dark:border-white/10 dark:text-slate-200">
                <span>Total batch cost ({units} unit{units === 1 ? "" : "s"})</span>
                <span>{money(breakdown.totalCost)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-slate-900 dark:text-white">
                <span>Cost per unit</span>
                <span>{money(breakdown.costPerUnit)}</span>
              </div>
            </div>

            {breakdown.usedSlicerFilamentCost && (
              <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                Using your slicer&rsquo;s reported filament cost: {money(breakdown.filamentCost)} for {units} unit
                {units === 1 ? "" : "s"} = {money(breakdown.filamentCost / units)} per unit. The internal roll-price
                calculation is not being used.
              </p>
            )}

            {breakdown.defaultedColors.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                <p>
                  ⚠ Using the {money(DEFAULT_ROLL_PRICE)}/roll default — enter the real price to make this accurate:
                </p>
                <ul className="mt-1 space-y-0.5">
                  {breakdown.defaultedColors.map((c, i) => (
                    <li key={i}>
                      <span className="font-semibold">
                        {c.material} {c.color}
                      </span>
                      {c.rollId ? (
                        <>
                          {" — "}
                          <Link href={`/inventory/${c.rollId}/edit`} className="underline hover:no-underline">
                            set its price →
                          </Link>
                        </>
                      ) : (
                        " — pick or add a roll for this color above"
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Suggested sale price per unit
              </label>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                Starts at 2.5× the complete per-unit production cost, then accounts for each channel&rsquo;s fixed and
                percentage fees.
              </p>
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                {channelPrices.map(({ channel, price }) => (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setChannelId(channel.id)}
                    className={`flex w-full items-center justify-between px-4 py-2 text-sm transition-colors ${
                      channelId === channel.id
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.06]"
                    } ${channel.id !== channelPrices[channelPrices.length - 1].channel.id ? "border-b border-slate-100 dark:border-white/10" : ""}`}
                  >
                    <span>{channel.label}</span>
                    <span className="font-semibold">{Number.isFinite(price) ? `${money(price)} / unit` : "—"}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                Suggested price via {selectedChannel?.label}: {Number.isFinite(suggestedPrice) ? money(suggestedPrice) : "—"} / unit
              </p>
              <EstimateDisclaimer className="mt-3" />
            </div>
          </div>
        </>
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

          {displayedFiles.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {displayedFiles.map((file) => (
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

      {project ? (
        <button
          type="submit"
          disabled={saving}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-lg shadow-blue-950/15 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      ) : (
        <div className="flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="h-12 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
            >
              Back
            </button>
          )}
          {step < STEP_LABELS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex h-12 flex-1 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-lg shadow-blue-950/15 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={saving || !canSubmit}
              className="flex h-12 flex-1 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-lg shadow-blue-950/15 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving…" : "Create project"}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
