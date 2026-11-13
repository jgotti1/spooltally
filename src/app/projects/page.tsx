"use client";

import { Select } from "@/components/Select";
import { useEffect, useMemo, useState } from "react";
import { ListScroll, Pager, usePaged } from "@/components/Pager";
import { addedLabel } from "@/lib/format-date";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/inventory-constants";
import { deleteProject, subscribeToProjects, visibleProjectFiles, type Project } from "@/lib/projects";
import { subscribeToRolls, type Roll } from "@/lib/rolls";
import { describeShortage, projectStock } from "@/lib/project-stock";
import { PROJECT_SORT_OPTIONS, sortProjects, type ProjectSortOption } from "@/lib/project-sort";
import {
  DEFAULT_ESTIMATOR_SETTINGS,
  getEstimatorSettings,
  type EstimatorSettings,
} from "@/lib/estimator-settings";
import { EstimateDisclaimer } from "@/components/EstimateDisclaimer";
import { calcCostBreakdown, calcSuggestedPrice } from "@/lib/estimator-pricing";
import { ClipboardArt } from "@/components/ui/Art";

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

function ImageIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-5 w-5">
      <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="7.25" cy="8" r="1.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 13.5 7.5 10l2.5 2.3 2.5-2.8 4 3.8" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function CubeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-5 w-5">
      <path
        d="M10 2.5 17 6.5v7L10 17.5 3 13.5v-7L10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M3 6.5 10 10.5l7-4M10 10.5v7" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function ProjectThumb({ project, className, compact = false }: { project: Project; className: string; compact?: boolean }) {
  const image = project.files.find((f) => f.type === "image");
  if (image) {
    return (
      <a href={image.url} target="_blank" rel="noreferrer" className={`${className} block shrink-0 overflow-hidden`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={project.name} className="h-full w-full object-cover" />
      </a>
    );
  }

  const model = project.files.find((f) => f.type === "model");
  if (model) {
    const ext = model.name.split(".").pop()?.toUpperCase() ?? "FILE";
    return (
      <a
        href={model.url}
        target="_blank"
        rel="noreferrer"
        title={`No preview available — click to download ${model.name}`}
        className={`${className} flex shrink-0 flex-col items-center justify-center gap-1 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15`}
      >
        <CubeIcon />
        {!compact && (
          <>
            <span className="text-[11px] font-semibold">No preview available</span>
            <span className="text-[10px] font-medium opacity-70">from your {ext} upload</span>
          </>
        )}
      </a>
    );
  }

  return (
    <div
      className={`${className} flex flex-col items-center justify-center gap-1 bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500`}
    >
      <ImageIcon />
      <span className="text-[10px] font-semibold uppercase tracking-wide">No image</span>
    </div>
  );
}

const STATUS_BADGE_CLASSES: Record<ProjectStatus, string> = {
  Active: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Archived: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

const money = (value: number) => `$${value.toFixed(2)}`;
const measurementFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const measurement = (value: number) => measurementFormatter.format(value);

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [pricingSettings, setPricingSettings] = useState<EstimatorSettings>(DEFAULT_ESTIMATOR_SETTINGS);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "All">("All");
  const [search, setSearch] = useState("");
  const [reorderOnly, setReorderOnly] = useState(false);
  const [sortBy, setSortBy] = useState<ProjectSortOption>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    return subscribeToProjects(
      user.uid,
      (next) => {
        setProjects(next);
        setProjectsLoading(false);
        setProjectsError("");
      },
      (error) => {
        setProjectsLoading(false);
        setProjectsError(error.message || "Couldn't load your projects. Please refresh and try again.");
      },
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToRolls(user.uid, setRolls);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getEstimatorSettings(user.uid)
      .then((next) => {
        if (active) setPricingSettings(next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  const rollsById = useMemo(() => new Map(rolls.map((r) => [r.id, r])), [rolls]);

  const projectMetrics = useMemo(
    () =>
      new Map(
        projects.map((project) => {
          const breakdown = calcCostBreakdown(
            project.colorsNeeded.map((color) => ({
              material: color.material,
              color: color.color,
              grams: color.gramsNeeded ?? 0,
              rollId: color.rollIds[0] ?? null,
            })),
            rollsById,
            project.printHours,
            project.quantity,
            pricingSettings,
            project.slicerFilamentCost,
          );
          const channel =
            pricingSettings.channels.find((candidate) => candidate.id === project.channelId) ??
            pricingSettings.channels[0];
          return [
            project.id,
            {
              breakdown,
              channel,
              suggestedPrice: channel
                ? calcSuggestedPrice(breakdown.costPerUnit, pricingSettings.targetProfitPercent, channel)
                : 0,
              totalGrams: project.colorsNeeded.reduce((sum, color) => sum + (color.gramsNeeded ?? 0), 0),
              visibleFileCount: visibleProjectFiles(project.files).length,
            },
          ] as const;
        }),
      ),
    [projects, rollsById, pricingSettings],
  );

  const stockByProject = useMemo(
    () => new Map(projects.map((project) => [project.id, projectStock(project, rolls)] as const)),
    [projects, rolls],
  );
  const needsReorder = useMemo(
    () => (project: Project) => stockByProject.get(project.id)?.short ?? false,
    [stockByProject],
  );

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "All" && p.status !== statusFilter) return false;
      if (reorderOnly && !needsReorder(p)) return false;
      if (search.trim()) {
        const haystack = `${p.name} ${p.colorsNeeded.map((n) => `${n.material} ${n.color}`).join(" ")}`.toLowerCase();
        if (!haystack.includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [projects, statusFilter, reorderOnly, search, needsReorder]);

  const sorted = useMemo(() => sortProjects(filtered, sortBy), [filtered, sortBy]);
  // List view only: 15 rows per page inside a scrolling box, so a long project list doesn't stretch the page.
  const paged = usePaged(sorted, `${search}|${statusFilter}|${reorderOnly}|${sortBy}`, 15);

  async function handleDelete(project: Project) {
    if (
      !window.confirm(
        `Delete project "${project.name}"? Any linked rolls still in stock are kept — only ones at 0g that aren't needed by another project are removed too.`,
      )
    )
      return;
    try {
      await deleteProject(project.id);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Couldn't delete that project. Please try again.");
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
            <span className="st-badge st-badge-violet mt-1">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <rect x="4" y="3.5" width="12" height="14" rx="2" />
                <path d="M7.5 3.5V2.5h5v1M7.5 9h5M7.5 12.5h5" />
              </svg>
            </span>
            <div>
              <p className="st-eyebrow">Projects</p>
              <h1 className="st-title mt-1">Projects</h1>
              <p className="st-lede mt-2">Each print job with its colors, costs, and the price worth charging.</p>
            </div>
          </div>
          <Link
            href="/projects/new"
            className="flex h-11 items-center gap-2 st-btn-primary px-4"
          >
            <PlusIcon />
            New project
          </Link>
        </div>

        <div className="mt-6 flex gap-2">
          {(["All", ...PROJECT_STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`h-9 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                statusFilter === s
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="st-toolbar mt-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, material, color…"
            className="h-11 min-w-[200px] flex-1 rounded-xl border border-transparent bg-slate-100/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:bg-white dark:bg-white/[0.05] dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-white/[0.08]"
          />
          <button
            type="button"
            onClick={() => setReorderOnly((v) => !v)}
            aria-pressed={reorderOnly}
            className={`h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition-colors ${
              reorderOnly
                ? "bg-rose-50 text-rose-700 shadow-[inset_0_0_0_1px_rgba(225,29,72,0.35)] dark:bg-rose-500/10 dark:text-rose-300"
                : "bg-slate-100/70 text-slate-600 hover:bg-slate-200/70 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.08]"
            }`}
          >
            Low filament only
          </button>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as ProjectSortOption)}
            className="h-11 rounded-xl border border-transparent bg-slate-100/70 px-3 text-sm text-slate-950 focus:bg-white dark:bg-white/[0.05] dark:text-white dark:focus:bg-white/[0.08]"
          >
            {PROJECT_SORT_OPTIONS.map((opt) => (
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
        </div>

        {projectsError && (
          <p className="mt-6 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {projectsError}
          </p>
        )}

        <EstimateDisclaimer className="mt-5" />

        <div className="mt-6">
          {projectsLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading projects…</p>
          ) : sorted.length === 0 ? (
            <div className="st-empty st-rise px-8 py-12">
              <ClipboardArt className="mx-auto h-28 w-auto" />
              <p className="mt-4 font-display text-lg font-semibold tracking-[-0.01em] text-slate-950 dark:text-white">
                {projects.length === 0 ? "No projects yet." : "No projects match your filters."}
              </p>
              {projects.length === 0 && (
                <p className="st-lede mx-auto mt-1 max-w-sm">Set up a print job once and get its cost and a suggested price for every channel.</p>
              )}
              {projects.length === 0 && (
                <Link
                  href="/projects/new"
                  className="st-btn-primary mt-6 h-11 px-5"
                >
                  <PlusIcon />
                  Create your first project
                </Link>
              )}
            </div>
          ) : viewMode === "list" ? (
            <div className="st-card overflow-hidden">
              <ListScroll page={paged.pager.page}>
              {paged.pageItems.map((project, i) => {
                const flagged = needsReorder(project);
                const metrics = projectMetrics.get(project.id);
                return (
                  <div
                    key={project.id}
                    onDoubleClick={() => router.push(`/projects/${project.id}/edit`)}
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.03] ${
                      i > 0 ? "border-t border-slate-100 dark:border-white/10" : ""
                    } ${flagged ? "bg-rose-50/60 dark:bg-rose-500/[0.06]" : ""}`}
                  >
                    <ProjectThumb project={project} compact className="h-11 w-11 shrink-0 rounded-lg" />
                    <div className="min-w-[240px] flex-1">
                      <p className="font-semibold [overflow-wrap:anywhere] text-slate-900 dark:text-white">{project.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {metrics ? `${money(metrics.breakdown.totalCost)} total · ${money(metrics.breakdown.costPerUnit)}/unit cost · ${money(metrics.suggestedPrice)}/unit suggested` : "Calculating cost…"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                        {measurement(metrics?.totalGrams ?? 0)}g filament · {project.colorsNeeded.length} color
                        {project.colorsNeeded.length === 1 ? "" : "s"} · {project.nozzleSizeMm === null ? "—" : measurement(project.nozzleSizeMm)}mm nozzle · {project.printHours ? measurement(project.printHours) : "—"}h · batch of {project.quantity}
                        {addedLabel(project.createdAt) && ` · ${addedLabel(project.createdAt)}`}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE_CLASSES[project.status]}`}
                    >
                      {project.status}
                    </span>
                    {(metrics?.visibleFileCount ?? 0) > 0 && (
                      <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        {metrics?.visibleFileCount} file{metrics?.visibleFileCount === 1 ? "" : "s"}
                      </span>
                    )}
                    {flagged ? (
                      <span
                        className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                        title={describeShortage(stockByProject.get(project.id)!)}
                      >
                        Low filament
                      </span>
                    ) : (
                      stockByProject.get(project.id)?.unitsPossible !== null && (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          Can make {stockByProject.get(project.id)?.unitsPossible} more
                        </span>
                      )
                    )}
                    <div className="ml-auto flex shrink-0 gap-2">
                      <Link
                        href={`/projects/${project.id}/edit`}
                        className="st-btn-secondary h-8 px-3 text-xs"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(project)}
                        aria-label="Delete project"
                        className="st-btn-danger h-8 w-8"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
              </ListScroll>
              <Pager {...paged.pager} noun="projects" className="border-t border-slate-100 px-5 py-3 dark:border-white/10" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((project) => {
                const flagged = needsReorder(project);
                const metrics = projectMetrics.get(project.id);
                return (
                  <div
                    key={project.id}
                    onDoubleClick={() => router.push(`/projects/${project.id}/edit`)}
                    className={`st-card st-card-hover flex flex-col p-4 ${flagged ? "st-accent st-accent-rose" : ""}`}
                  >
                    <ProjectThumb project={project} className="h-36 w-full rounded-xl shadow-[inset_0_0_0_1px_var(--st-ring)]" />

                    <div className="mt-3 flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 font-display text-base leading-tight font-semibold tracking-[-0.01em] [overflow-wrap:anywhere] text-slate-950 dark:text-white">{project.name}</p>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE_CLASSES[project.status]}`}
                      >
                        {project.status}
                      </span>
                    </div>

                    {flagged ? (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-500/30 dark:bg-rose-500/10">
                        <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">Low filament — order soon</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-rose-700/80 dark:text-rose-300/80">
                          {describeShortage(stockByProject.get(project.id)!)}
                        </p>
                      </div>
                    ) : (
                      stockByProject.get(project.id)?.unitsPossible !== null && (
                        <span className="mt-3 inline-flex w-fit items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          Can make {stockByProject.get(project.id)?.unitsPossible} more unit
                          {stockByProject.get(project.id)?.unitsPossible === 1 ? "" : "s"} from stock
                        </span>
                      )
                    )}

                    <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs dark:bg-white/[0.03]">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase dark:text-slate-500">Suggested / unit</p>
                          <p className="mt-1 font-display text-2xl leading-none font-semibold tracking-[-0.02em] text-slate-950 tabular-nums dark:text-white">
                            {metrics ? money(metrics.suggestedPrice) : "—"}
                          </p>
                        </div>
                        <div className="text-right text-slate-500 tabular-nums dark:text-slate-400">
                          <p>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{metrics ? money(metrics.breakdown.costPerUnit) : "—"}</span> cost / unit
                          </p>
                          <p className="mt-0.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{metrics ? money(metrics.breakdown.totalCost) : "—"}</span> batch total
                          </p>
                        </div>
                      </div>
                      <p className="border-t border-slate-200 pt-2 text-slate-500 dark:border-white/10 dark:text-slate-400">
                        {measurement(metrics?.totalGrams ?? 0)}g filament · {project.colorsNeeded.length} color
                        {project.colorsNeeded.length === 1 ? "" : "s"} · {project.nozzleSizeMm === null ? "—" : measurement(project.nozzleSizeMm)}mm nozzle
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        {project.printHours ? measurement(project.printHours) : "—"}h print · batch of {project.quantity} · {metrics?.channel?.label ?? "No channel"}
                      </p>
                      {addedLabel(project.createdAt) && <p className="text-slate-400 dark:text-slate-500">{addedLabel(project.createdAt)}</p>}
                      {project.colorsNeeded.length > 0 && (
                        <p className="truncate text-slate-400 dark:text-slate-500">
                          {project.colorsNeeded.map((need) => `${need.color} ${need.material}`).join(", ")}
                        </p>
                      )}
                    </div>

                    {(metrics?.visibleFileCount ?? 0) > 0 && (
                      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                        {metrics?.visibleFileCount} file{metrics?.visibleFileCount === 1 ? "" : "s"} attached
                      </p>
                    )}

                    <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
                      <Link
                        href={`/projects/${project.id}/edit`}
                        className="st-btn-secondary h-9 flex-1 text-xs"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(project)}
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
