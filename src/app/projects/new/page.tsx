"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { ProjectForm } from "@/components/ProjectForm";

export default function NewProjectPage() {
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
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-14 sm:px-10">
        <BackLink href="/projects" label="Back to projects" />
        <p className="st-eyebrow">Projects</p>
        <h1 className="mt-2 st-title">New project</h1>

        <div className="mt-8 st-card p-6 sm:p-8">
          <ProjectForm key={router.bfcacheId} />
        </div>
      </div>
    </main>
  );
}
