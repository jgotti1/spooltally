import "server-only";
import { ADMIN_AUDIT_COLLECTION, adminDb, iso } from "@/lib/admin/server";
import type { AuditEntry, HistoryKind } from "@/lib/account-status";

export type KindFilter = HistoryKind | "all";

/** History older than this is deleted automatically every day (see /api/cron/purge-history). Export first if you need more. */
export const HISTORY_RETENTION_DAYS = 90;

/** Deletes history older than `days` (or everything when null) in batches, returning how many entries were removed. */
export async function purgeHistoryOlderThan(days: number | null): Promise<number> {
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
  return deleted;
}

export function parseKind(value: string | null): KindFilter {
  return value === "admin" || value === "system" ? value : "all";
}

export function toEntry(id: string, d: FirebaseFirestore.DocumentData): AuditEntry {
  return {
    id,
    // Entries written before the `kind` field existed were all admin actions.
    kind: d.kind === "system" ? "system" : "admin",
    actorUid: String(d.actorUid ?? ""),
    actorEmail: String(d.actorEmail ?? ""),
    action: String(d.action ?? ""),
    targetUid: typeof d.targetUid === "string" ? d.targetUid : null,
    details: d.details && typeof d.details === "object" ? d.details : {},
    at: iso(d.at),
  };
}

/**
 * Walks the log newest-first in pages, applying the kind and age filters in memory (so no composite index is needed),
 * until `limit` matching entries are collected or the log runs out. `cursor` is the id of the last entry already seen.
 */
export async function scanHistory(opts: {
  kind: KindFilter;
  limit: number;
  cursor?: string | null;
  sinceDays?: number | null;
}): Promise<{ entries: AuditEntry[]; nextCursor: string | null }> {
  const col = adminDb().collection(ADMIN_AUDIT_COLLECTION);
  const since = opts.sinceDays ? Date.now() - opts.sinceDays * 86_400_000 : null;
  const entries: AuditEntry[] = [];
  let query = col.orderBy("at", "desc").limit(500);
  if (opts.cursor) {
    const cursorDoc = await col.doc(opts.cursor).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let exhausted = false;
  while (entries.length < opts.limit && !exhausted) {
    const snap = await query.get();
    if (snap.empty) {
      exhausted = true;
      break;
    }
    for (const doc of snap.docs) {
      last = doc;
      const entry = toEntry(doc.id, doc.data());
      if (since !== null && entry.at && new Date(entry.at).getTime() < since) {
        exhausted = true; // newest-first, so everything after this is older still
        break;
      }
      if (opts.kind !== "all" && entry.kind !== opts.kind) continue;
      entries.push(entry);
      if (entries.length >= opts.limit) break;
    }
    if (snap.size < 500) exhausted = true;
    if (!exhausted && entries.length < opts.limit && last) query = col.orderBy("at", "desc").limit(500).startAfter(last);
  }
  return { entries, nextCursor: exhausted || !last ? null : last.id };
}
