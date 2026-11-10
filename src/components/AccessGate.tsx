"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAccountStatus } from "@/lib/use-account";

/** Pages a locked account may still open: sign-in, picking a plan, account info, and contacting support. */
const OPEN_PATHS = ["/subscribe", "/account", "/contact", "/admin"];

/**
 * Sends a locked account (trial ended, no subscription) to /subscribe, and signs a frozen account out straight away.
 * This is the friendly half; Firestore rules are the real lock. Admins are never locked, and view-as shows a
 * locked customer's data as-is so an admin can still troubleshoot it.
 */
export function AccessGate() {
  const { user, isAdmin, viewingAs, signOut } = useAuth();
  const { info } = useAccountStatus();
  const pathname = usePathname();
  const router = useRouter();

  const exempt = !user || isAdmin || Boolean(viewingAs);
  const frozen = !exempt && info?.status === "disabled";
  const locked = !exempt && !frozen && info?.locked === true;
  const onOpenPath = pathname === "/" || OPEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  useEffect(() => {
    if (frozen) void signOut();
    else if (locked && !onOpenPath) router.replace("/subscribe");
  }, [frozen, locked, onOpenPath, router, signOut]);

  return null;
}
