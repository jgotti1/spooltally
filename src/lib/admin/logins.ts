import "server-only";
import { adminDb, iso } from "@/lib/admin/server";
import type { LoginEntry } from "@/lib/account-status";

/** Sign-in history is kept this long, then deleted by the daily cron job (/api/cron/purge-history). */
export const LOGIN_RETENTION_DAYS = 60;
export const LOGIN_COLLECTION = "loginHistory";

/** A short "Chrome on macOS" label. Deliberately coarse: the raw user-agent string is never stored. */
export function describeDevice(userAgent: string | null): string {
  const ua = userAgent ?? "";
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "unknown OS";
  return `${browser} on ${os}`;
}

/** Records one sign-in: when, how (password or Google), on what kind of device, and from which country. Never throws. */
export async function recordLogin(request: Request, uid: string, method: string) {
  try {
    const { FieldValue } = await import("firebase-admin/firestore");
    const country = request.headers.get("x-vercel-ip-country") ?? "";
    await adminDb().collection(LOGIN_COLLECTION).add({
      uid,
      at: FieldValue.serverTimestamp(),
      method,
      device: describeDevice(request.headers.get("user-agent")),
      country: /^[A-Z]{2}$/.test(country) ? country : "",
    });
  } catch (error) {
    console.error("[logins] write failed", error);
  }
}

/** One account's sign-ins, newest first. Sorted in memory so it needs no composite index. */
export async function listLogins(uid: string): Promise<LoginEntry[]> {
  const snap = await adminDb().collection(LOGIN_COLLECTION).where("uid", "==", uid).limit(1000).get();
  return snap.docs
    .map((doc) => {
      const d = doc.data();
      return { id: doc.id, at: iso(d.at), method: String(d.method ?? ""), device: String(d.device ?? ""), country: String(d.country ?? "") };
    })
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}

async function deleteQuery(query: FirebaseFirestore.Query): Promise<number> {
  const db = adminDb();
  let deleted = 0;
  for (;;) {
    const snap = await query.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
  }
  return deleted;
}

export async function purgeLoginsOlderThan(days: number): Promise<number> {
  const { Timestamp } = await import("firebase-admin/firestore");
  return deleteQuery(adminDb().collection(LOGIN_COLLECTION).where("at", "<", Timestamp.fromMillis(Date.now() - days * 86_400_000)));
}

export async function deleteLoginsFor(uid: string): Promise<number> {
  return deleteQuery(adminDb().collection(LOGIN_COLLECTION).where("uid", "==", uid));
}
