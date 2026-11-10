"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/** Always-visible reminder while an admin is looking at a customer's account. Nothing they do here can change that data. */
export function ViewAsBanner() {
  const { viewingAs, stopViewAs } = useAuth();
  const router = useRouter();
  if (!viewingAs) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-amber-300 bg-amber-50 py-2 pr-2 pl-4 text-sm text-amber-950 shadow-xl dark:border-amber-400/40 dark:bg-amber-950 dark:text-amber-100"
    >
      <span className="min-w-0 truncate">
        <span className="font-semibold">Viewing as {viewingAs.name || viewingAs.email}</span>
        <span className="hidden sm:inline"> · read-only</span>
      </span>
      <button
        type="button"
        onClick={() => {
          const uid = viewingAs.uid;
          stopViewAs();
          router.push(`/admin/users/${uid}`);
        }}
        className="shrink-0 rounded-full bg-amber-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
      >
        Exit
      </button>
    </div>
  );
}
