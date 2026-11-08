"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ComboSelect } from "@/components/ComboSelect";
import {
  BRAND_OPTIONS,
  COLOR_OPTIONS,
  MATERIAL_OPTIONS,
  PROJECT_STATUSES,
  SIZE_OPTIONS_GRAMS,
  type ProjectStatus,
} from "@/lib/inventory-constants";
import { addPlaceholderRoll, listRolls, type Roll } from "@/lib/rolls";
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
  const [placeholderDraft, setPlaceholderDraft] = useState<Record<number, { brand: string; sizeGrams: number }>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"model" | "image" | null>(null);
  const [error, setError] = useState("");
  const modelInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    listRolls(user.uid).then((rolls) => {
      if (active) setExistingRolls(rolls);
    });
    return () => {
      active = false;
    };
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
    try {
      const meta = await uploadProjectFile(user.uid, project.id, file, type);
      setFiles((prev) => [...prev, meta]);
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

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
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
                      value={need.gramsNeeded ?? ""}
                      onChange={(e) =>
                        updateColorNeed(index, { gramsNeeded: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      placeholder="Not sure yet"
                      className="h-12 w-28 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 placeholder:text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
                    />
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

          {files.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {files.map((file) => (
                <li
                  key={file.path}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.03]"
                >
                  {file.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.url} alt={file.name} className="h-9 w-9 rounded object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                      <FileIcon />
                    </span>
                  )}
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 truncate font-medium text-slate-700 hover:underline dark:text-slate-300"
                  >
                    {file.name}
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
