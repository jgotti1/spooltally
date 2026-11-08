"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/inventory-constants";
import { deleteProject, subscribeToProjects, type Project } from "@/lib/projects";
import { subscribeToRolls, type Roll } from "@/lib/rolls";

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

const STATUS_BADGE_CLASSES: Record<ProjectStatus, string> = {
  Active: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Queued: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
  Done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "All">("All");

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

  const rollsById = useMemo(() => new Map(rolls.map((r) => [r.id, r])), [rolls]);

  const filtered = useMemo(
    () => (statusFilter === "All" ? projects : projects.filter((p) => p.status === statusFilter)),
    [projects, statusFilter],
  );

  async function handleDelete(project: Project) {
    if (!window.confirm(`Delete project "${project.name}"? This won't delete any linked rolls.`)) return;
    try {
      await deleteProject(project.id);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Couldn't delete that project. Please try again.");
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
            <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-400">Projects</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl dark:text-white">
              Projects
            </h1>
          </div>
          <Link
            href="/projects/new"
            className="flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
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

        {projectsError && (
          <p className="mt-6 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {projectsError}
          </p>
        )}

        <div className="mt-6">
          {projectsLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading projects…</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-white/15 dark:bg-white/[0.02]">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {projects.length === 0 ? "No projects yet." : "No projects match this filter."}
              </p>
              {projects.length === 0 && (
                <Link
                  href="/projects/new"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                >
                  <PlusIcon />
                  Create your first project
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((project) => {
                const needsReorder = project.colorsNeeded.some((need) =>
                  need.rollIds.some((id) => (rollsById.get(id)?.remainingGrams ?? 0) === 0),
                );
                return (
                  <div
                    key={project.id}
                    className={`flex flex-col rounded-2xl border bg-white p-4 shadow-sm dark:bg-white/[0.03] ${
                      needsReorder ? "border-rose-300 dark:border-rose-500/40" : "border-slate-200 dark:border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{project.name}</p>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE_CLASSES[project.status]}`}
                      >
                        {project.status}
                      </span>
                    </div>

                    {needsReorder && (
                      <span className="mt-3 inline-flex w-fit items-center rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                        Order now — missing filament
                      </span>
                    )}

                    <ul className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                      {project.colorsNeeded.map((need, i) => (
                        <li key={i}>
                          {need.color} {need.material} — {need.gramsNeeded}g
                        </li>
                      ))}
                    </ul>

                    {project.files.length > 0 && (
                      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                        {project.files.length} file{project.files.length === 1 ? "" : "s"} attached
                      </p>
                    )}

                    <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
                      <Link
                        href={`/projects/${project.id}/edit`}
                        className="flex h-9 flex-1 items-center justify-center rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(project)}
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
