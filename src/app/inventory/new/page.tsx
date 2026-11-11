"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { RollForm } from "@/components/RollForm";

export default function NewRollPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

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
      <div className="mx-auto w-full max-w-xl flex-1 px-6 py-14 sm:px-10">
        <BackLink href="/inventory" label="Back to inventory" />
        <p className="st-eyebrow">Inventory</p>
        <h1 className="mt-2 st-title">Add a roll</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Log a new spool of filament. Partial rolls are tracked individually.
        </p>

        <div className="mt-8 st-card p-6 sm:p-8">
          <RollForm />
        </div>
      </div>
    </main>
  );
}
