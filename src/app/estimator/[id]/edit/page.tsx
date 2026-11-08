"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { CloseLink } from "@/components/CloseLink";
import { EstimatorForm } from "@/components/EstimatorForm";
import { getEstimate, type Estimate } from "@/lib/estimates";

function LoadingScreen() {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center bg-[#f5f8fc] dark:bg-[#05080e]">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</p>
    </main>
  );
}

function EditEstimatePageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [estimate, setEstimate] = useState<Estimate | null | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getEstimate(params.id)
      .then((found) => {
        if (!active) return;
        if (!found || found.ownerId !== user.uid) {
          setNotFound(true);
        } else {
          setEstimate(found);
        }
      })
      .catch(() => active && setNotFound(true));
    return () => {
      active = false;
    };
  }, [params.id, user]);

  if (loading || !user || (estimate === undefined && !notFound)) {
    return <LoadingScreen />;
  }

  return (
    <main className="flex min-h-svh flex-1 flex-col bg-[#f5f8fc] dark:bg-[#05080e]">
      <Header />
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-14 sm:px-10">
        <BackLink href="/estimator" label="Back to estimator" />
        <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-400">Estimator</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
          {estimate?.name ?? "Edit estimate"}
        </h1>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-white/[0.03]">
          {notFound || !estimate ? (
            <>
              <div className="mb-4 flex justify-end">
                <CloseLink href="/estimator" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                That estimate couldn&rsquo;t be found. It may have been deleted already.
              </p>
            </>
          ) : (
            <EstimatorForm estimate={estimate} />
          )}
        </div>
      </div>
    </main>
  );
}

export default function EditEstimatePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <EditEstimatePageInner />
    </Suspense>
  );
}
