"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { CloseLink } from "@/components/CloseLink";
import { RollForm } from "@/components/RollForm";
import { getRoll, type Roll } from "@/lib/rolls";
import { subscribeToProjects, type Project } from "@/lib/projects";

function LoadingScreen() {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center bg-[#f5f8fc] dark:bg-[#05080e]">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</p>
    </main>
  );
}

function EditRollPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [roll, setRoll] = useState<Roll | null | undefined>(undefined);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getRoll(params.id)
      .then((found) => {
        if (!active) return;
        if (!found || found.ownerId !== user.uid) {
          setNotFound(true);
        } else {
          setRoll(found);
        }
      })
      .catch(() => active && setNotFound(true));
    return () => {
      active = false;
    };
  }, [params.id, user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToProjects(user.uid, setProjects);
  }, [user]);

  const linkedProjects = useMemo(
    () => projects.filter((project) => project.colorsNeeded.some((color) => color.rollIds.includes(params.id))),
    [params.id, projects],
  );

  if (loading || !user || (roll === undefined && !notFound)) {
    return <LoadingScreen />;
  }

  return (
    <main className="flex min-h-svh flex-1 flex-col bg-[#f5f8fc] dark:bg-[#05080e]">
      <Header />
      <div className="mx-auto w-full max-w-xl flex-1 px-6 py-14 sm:px-10">
        <BackLink href="/inventory" label="Back to inventory" />
        <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-400">Inventory</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
          {roll ? `${roll.brand} ${roll.color} ${roll.material}` : "Edit roll"}
        </h1>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-white/[0.03]">
          {notFound || !roll ? (
            <>
              <div className="mb-4 flex justify-end">
                <CloseLink href="/inventory" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                That roll couldn&rsquo;t be found. It may have been deleted already.
              </p>
            </>
          ) : (
            <>
              <RollForm roll={roll} />

              <section className="mt-8 border-t border-slate-200 pt-6 dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Used by projects</h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {linkedProjects.length}
                  </span>
                </div>

                {linkedProjects.length === 0 ? (
                  <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    This roll is not currently linked to any projects.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {linkedProjects.map((project) => {
                      const usages = project.colorsNeeded.filter((color) => color.rollIds.includes(params.id));
                      return (
                        <li key={project.id}>
                          <Link
                            href={`/projects/${project.id}/edit`}
                            className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-blue-400/40 dark:hover:bg-blue-500/10"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                                {project.name}
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                                {usages
                                  .map(
                                    (usage) =>
                                      `${usage.color} ${usage.material}${usage.gramsNeeded === null ? "" : ` · ${usage.gramsNeeded}g`}`,
                                  )
                                  .join(", ")}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400">
                              Open project →
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function EditRollPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <EditRollPageInner />
    </Suspense>
  );
}
