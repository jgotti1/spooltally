"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { CloseLink } from "@/components/CloseLink";
import { RollForm } from "@/components/RollForm";
import { getRoll, type Roll } from "@/lib/rolls";

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
          <div className="mb-4 flex justify-end">
            <CloseLink href="/inventory" />
          </div>
          {notFound || !roll ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              That roll couldn&rsquo;t be found. It may have been deleted already.
            </p>
          ) : (
            <RollForm roll={roll} />
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
