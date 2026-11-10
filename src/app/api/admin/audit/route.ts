import { NextResponse } from "next/server";
import { ADMIN_AUDIT_COLLECTION, adminDb, iso, requireAdmin } from "@/lib/admin/server";
import type { AuditEntry } from "@/lib/account-status";

/** The admin activity log, newest first. `?uid=` narrows it to actions on one account. */
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const uid = new URL(request.url).searchParams.get("uid");
    const col = adminDb().collection(ADMIN_AUDIT_COLLECTION);
    // Filtering by account is sorted in memory so it needs no composite index.
    const snap = uid ? await col.where("targetUid", "==", uid).limit(500).get() : await col.orderBy("at", "desc").limit(300).get();
    const entries: AuditEntry[] = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          actorUid: String(d.actorUid ?? ""),
          actorEmail: String(d.actorEmail ?? ""),
          action: String(d.action ?? ""),
          targetUid: typeof d.targetUid === "string" ? d.targetUid : null,
          details: d.details && typeof d.details === "object" ? d.details : {},
          at: iso(d.at),
        };
      })
      .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't load the activity log." }, { status: 500 });
  }
}
