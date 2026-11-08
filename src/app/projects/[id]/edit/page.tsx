"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { CloseLink } from "@/components/CloseLink";
import { ProjectForm } from "@/components/ProjectForm";
import { getProject, type Project } from "@/lib/projects";
import { getEstimate, type Estimate } from "@/lib/estimates";
import { DEFAULT_CHANNELS } from "@/lib/estimator-constants";
import Link from "next/link";

function LoadingScreen() {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center bg-[#f5f8fc] dark:bg-[#05080e]">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</p>
    </main>
  );
}

function EditProjectPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getProject(params.id)
      .then((found) => {
        if (!active) return;
        if (!found || found.ownerId !== user.uid) {
          setNotFound(true);
        } else {
          setProject(found);
        }
      })
      .catch(() => active && setNotFound(true));
    return () => {
      active = false;
    };
  }, [params.id, user]);

  useEffect(() => {
    if (!project?.estimateId) return;
    let active = true;
    getEstimate(project.estimateId).then((found) => {
      if (active) setEstimate(found);
    });
    return () => {
      active = false;
    };
  }, [project?.estimateId]);

  if (loading || !user || (project === undefined && !notFound)) {
    return <LoadingScreen />;
  }

  return (
    <main className="flex min-h-svh flex-1 flex-col bg-[#f5f8fc] dark:bg-[#05080e]">
      <Header />
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-14 sm:px-10">
        <BackLink href="/projects" label="Back to projects" />
        <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-400">Projects</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
          {project?.name ?? "Edit project"}
        </h1>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-white/[0.03]">
          {notFound || !project ? (
            <>
              <div className="mb-4 flex justify-end">
                <CloseLink href="/projects" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                That project couldn&rsquo;t be found. It may have been deleted already.
              </p>
            </>
          ) : (
            <>
              {estimate && (
                <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
                  <p className="text-xs font-bold tracking-[0.1em] text-blue-700 uppercase dark:text-blue-300">
                    From estimate
                  </p>
                  <p className="mt-1 text-sm font-semibold text-blue-900 dark:text-blue-200">{estimate.name}</p>
                  <p className="mt-1 text-xs text-blue-800/80 dark:text-blue-300/80">
                    {estimate.printHours}h print &middot; {estimate.quantity} unit{estimate.quantity === 1 ? "" : "s"}{" "}
                    &middot; via {DEFAULT_CHANNELS.find((c) => c.id === estimate.channelId)?.label ?? estimate.channelId}
                  </p>
                  <Link
                    href={`/estimator/${estimate.id}/edit`}
                    className="mt-2 inline-flex text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300"
                  >
                    View / edit estimate →
                  </Link>
                </div>
              )}
              <ProjectForm project={project} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function EditProjectPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <EditProjectPageInner />
    </Suspense>
  );
}
