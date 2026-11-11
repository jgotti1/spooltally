import { NextResponse } from "next/server";
import { ADMIN_AUDIT_COLLECTION, adminDb, audit, requireAdmin, requireOwner } from "@/lib/admin/server";
import { parseKind, scanHistory, toEntry } from "@/lib/admin/history";
import type { AuditEntry } from "@/lib/account-status";

/**
 * The history log, newest first, for admins only (customers can never reach it: the collection has no Firestore rule).
 * `?uid=` narrows to one account; otherwise it pages through everything with `?kind=admin|system|all`, `?limit=` and
 * `?cursor=` (the `nextCursor` from the previous page).
 */
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const params = new URL(request.url).searchParams;
    const uid = params.get("uid");
    if (uid) {
      // Filtering by account is sorted in memory so it needs no composite index.
      const snap = await adminDb().collection(ADMIN_AUDIT_COLLECTION).where("targetUid", "==", uid).limit(500).get();
      const entries: AuditEntry[] = snap.docs.map((doc) => toEntry(doc.id, doc.data())).sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
      return NextResponse.json({ entries, nextCursor: null });
    }
    const limit = Math.min(Math.max(Number(params.get("limit")) || 100, 1), 300);
    return NextResponse.json(await scanHistory({ kind: parseKind(params.get("kind")), limit, cursor: params.get("cursor") }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't load the history." }, { status: 500 });
  }
}

/**
 * Permanently deletes history. Owner only. Body: { confirm: "PURGE", olderThanDays?: number } — leave olderThanDays out
 * to delete everything. A "purged history" entry is written afterwards so the deletion itself stays on the record.
 */
export async function DELETE(request: Request) {
  const guard = await requireOwner(request);
  if (!guard.ok) return guard.response;

  let body: { confirm?: unknown; olderThanDays?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (body.confirm !== "PURGE") return NextResponse.json({ error: "Type PURGE to confirm. Nothing was deleted." }, { status: 400 });
  const days = typeof body.olderThanDays === "number" && body.olderThanDays > 0 ? Math.floor(body.olderThanDays) : null;

  try {
    const db = adminDb();
    const col = db.collection(ADMIN_AUDIT_COLLECTION);
    const { Timestamp } = await import("firebase-admin/firestore");
    const cutoff = days ? Timestamp.fromMillis(Date.now() - days * 86_400_000) : null;
    let deleted = 0;
    for (;;) {
      const snap = await (cutoff ? col.where("at", "<", cutoff) : col).limit(400).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deleted += snap.size;
    }
    await audit(guard.token, "purge_history", null, { deleted, olderThanDays: days });
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't purge the history." }, { status: 500 });
  }
}
