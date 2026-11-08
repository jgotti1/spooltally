"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { deleteEstimate, subscribeToEstimates, type Estimate } from "@/lib/estimates";
import { subscribeToProjects, type Project } from "@/lib/projects";
import { subscribeToRolls, type Roll } from "@/lib/rolls";
import { getEstimatorSettings, DEFAULT_ESTIMATOR_SETTINGS, type EstimatorSettings } from "@/lib/estimator-settings";
import { calcCostBreakdown, calcSuggestedPrice } from "@/lib/estimator-pricing";

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

export default function EstimatorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [settings, setSettings] = useState<EstimatorSettings>(DEFAULT_ESTIMATOR_SETTINGS);
  const [estimatesLoading, setEstimatesLoading] = useState(true);
  const [estimatesError, setEstimatesError] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    return subscribeToEstimates(
      user.uid,
      (next) => {
        setEstimates(next);
        setEstimatesLoading(false);
        setEstimatesError("");
      },
      (error) => {
        setEstimatesLoading(false);
        setEstimatesError(error.message || "Couldn't load your estimates. Please refresh and try again.");
      },
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToProjects(user.uid, setProjects);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToRolls(user.uid, setRolls);
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
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  async function handleDelete(estimate: Estimate) {
    if (!window.confirm(`Delete estimate "${estimate.name}"? This won't delete any linked project.`)) return;
    try {
      await deleteEstimate(estimate.id);
    } catch (error) {
      setEstimatesError(error instanceof Error ? error.message : "Couldn't delete that estimate. Please try again.");
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
            <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-400">Estimator</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl dark:text-white">
              Price a print
            </h1>
          </div>
          <Link
            href="/estimator/new"
            className="flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            <PlusIcon />
            New estimate
          </Link>
        </div>

        {estimatesError && (
          <p className="mt-6 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {estimatesError}
          </p>
        )}

        <div className="mt-6">
          {estimatesLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading estimates…</p>
          ) : estimates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-white/15 dark:bg-white/[0.02]">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No estimates yet.</p>
              <Link
                href="/estimator/new"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
              >
                <PlusIcon />
                Price your first job
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {estimates.map((estimate) => {
                const breakdown = calcCostBreakdown(
                  estimate.colorsUsed,
                  rollsById,
                  estimate.printHours,
                  estimate.quantity,
                  settings,
                );
                const channel = settings.channels.find((c) => c.id === estimate.channelId) ?? settings.channels[0];
                const price = channel ? calcSuggestedPrice(breakdown.costPerUnit, settings.targetProfitPercent, channel) : 0;
                const project = estimate.projectId ? projectsById.get(estimate.projectId) : undefined;
                return (
                  <div
                    key={estimate.id}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{estimate.name}</p>
                    {project && (
                      <Link
                        href={`/projects/${project.id}/edit`}
                        className="mt-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Linked to {project.name}
                      </Link>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Cost: ${breakdown.costPerUnit.toFixed(2)}/unit</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {Number.isFinite(price) ? `$${price.toFixed(2)}` : "—"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">via {channel?.label}</p>

                    <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
                      <Link
                        href={`/estimator/${estimate.id}/edit`}
                        className="flex h-9 flex-1 items-center justify-center rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(estimate)}
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
