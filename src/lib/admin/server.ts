import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { NextResponse } from "next/server";
import { TRIAL_DAYS, type AccountRecord, type AdminUserSummary } from "@/lib/account-status";

/**
 * Server-only Firebase Admin access. It needs a service-account key in FIREBASE_SERVICE_ACCOUNT_JSON (never a NEXT_PUBLIC_
 * variable, never committed). Admin rights come from the Firebase custom claim `admin` on the caller's ID token.
 */
export class AdminConfigError extends Error {}

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT_JSON isn't set. Add the service-account key to .env.local and restart the server.");
  }
  const account = parseServiceAccount(raw);
  if (!account) {
    throw new AdminConfigError(
      "FIREBASE_SERVICE_ACCOUNT_JSON isn't valid JSON for a service account. Paste the downloaded key file's contents as-is (starting with { and ending with }), with no name= prefix, then redeploy.",
    );
  }
  try {
    return initializeApp({ credential: cert(account), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  } catch {
    throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT_JSON parsed, but isn't a usable service-account key. Download a fresh key from Firebase.");
  }
}

/**
 * Forgiving parse for the key as pasted into Vercel or .env: tolerates wrapping quotes, a leading `NAME=`, and a private_key
 * whose newlines were turned into real line breaks (which strict JSON rejects).
 */
function parseServiceAccount(raw: string): Record<string, unknown> | null {
  let text = raw.trim().replace(/^FIREBASE_SERVICE_ACCOUNT_JSON\s*=\s*/, "");
  if (/^(['"`])[\s\S]*\1$/.test(text) && !text.startsWith('{"')) text = text.slice(1, -1);
  const attempts = [
    text,
    text.replace(/("private_key"\s*:\s*")([\s\S]*?)(")/, (_m, open: string, key: string, close: string) => open + key.replace(/\r?\n/g, "\\n") + close),
  ];
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === "object" && typeof parsed.private_key === "string") {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
        return parsed;
      }
    } catch {}
  }
  return null;
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function adminBucket() {
  return getStorage(adminApp()).bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
}

export function adminDb() {
  return getFirestore(adminApp());
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

type Guard = { ok: true; token: DecodedIdToken } | { ok: false; response: NextResponse };

function failure(error: unknown): NextResponse {
  if (error instanceof AdminConfigError) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ error: "Not signed in." }, { status: 401 });
}

/** Any signed-in user (ID token verified, revoked tokens rejected). */
export async function requireUser(request: Request): Promise<Guard> {
  const token = bearerToken(request);
  if (!token) return { ok: false, response: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  try {
    return { ok: true, token: await adminAuth().verifyIdToken(token, true) };
  } catch (error) {
    return { ok: false, response: failure(error) };
  }
}

/** The owner only: a verified ID token carrying the `admin` custom claim. */
export async function requireAdmin(request: Request): Promise<Guard> {
  const guard = await requireUser(request);
  if (!guard.ok) return guard;
  if (guard.token.admin !== true) {
    return { ok: false, response: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }
  return guard;
}

/** The app owner only: the `owner` custom claim, which is what allows granting admin rights to others. */
export async function requireOwner(request: Request): Promise<Guard> {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard;
  if (guard.token.owner !== true) {
    return { ok: false, response: NextResponse.json({ error: "Only the owner can change admin access." }, { status: 403 }) };
  }
  return guard;
}

/**
 * Owner-only notes (private notes, the reason an account is comped). They live outside `users/{uid}` because a user can
 * read their own `users` doc; no Firestore rule matches this collection, so only the Admin SDK can reach it.
 */
export const ADMIN_PRIVATE_COLLECTION = "adminPrivate";

export function iso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}

export function accountFromDoc(data: FirebaseFirestore.DocumentData | undefined): AccountRecord {
  const d = data ?? {};
  return {
    name: typeof d.name === "string" ? d.name : "",
    email: typeof d.email === "string" ? d.email : "",
    createdAt: iso(d.createdAt),
    trialEndsAt: iso(d.trialEndsAt),
    plan: d.plan === "monthly" || d.plan === "quarterly" || d.plan === "yearly" ? d.plan : "trial",
    lastLogin: iso(d.lastLogin),
    isComped: d.isComped === true,
    compNote: typeof d.compNote === "string" ? d.compNote : "",
    disabled: d.disabled === true,
    subscriptionStatus: typeof d.subscriptionStatus === "string" ? d.subscriptionStatus : "",
    adminNotes: typeof d.adminNotes === "string" ? d.adminNotes : "",
    privacyAcknowledgedAt: iso(d.privacyAcknowledgedAt),
    privacyVersion: typeof d.privacyVersion === "number" ? d.privacyVersion : null,
  };
}

/**
 * The account record for an Auth user. Someone who hasn't opened the app since `users` docs existed has no doc yet, so
 * their trial is derived from the signup date exactly as /api/session will store it.
 */
export function accountForAuthUser(
  authUser: { metadata: { creationTime: string } },
  data: FirebaseFirestore.DocumentData | undefined,
): AccountRecord {
  const account = accountFromDoc(data);
  if (!data) {
    const created = new Date(authUser.metadata.creationTime);
    account.createdAt = created.toISOString();
    account.trialEndsAt = new Date(created.getTime() + TRIAL_DAYS * 86_400_000).toISOString();
  }
  return account;
}

export function summarize(
  authUser: {
    uid: string;
    email?: string;
    displayName?: string;
    customClaims?: { [key: string]: unknown };
    metadata: { creationTime: string; lastSignInTime: string };
  },
  account: AccountRecord,
  shopName: string,
): AdminUserSummary {
  const toIso = (value: string) => (value ? new Date(value).toISOString() : null);
  return {
    uid: authUser.uid,
    // A name that is just the account's ID (seen on hand-made test accounts) is treated as no name at all.
    name: [account.name, authUser.displayName ?? ""].map((n) => n.trim()).find((n) => n && n !== authUser.uid) ?? "",
    email: authUser.email ?? account.email,
    shopName,
    createdAt: account.createdAt ?? toIso(authUser.metadata.creationTime),
    lastSignIn: toIso(authUser.metadata.lastSignInTime),
    lastLogin: account.lastLogin,
    trialEndsAt: account.trialEndsAt,
    plan: account.plan,
    isComped: account.isComped,
    disabled: account.disabled,
    subscriptionStatus: account.subscriptionStatus,
    isAdmin: authUser.customClaims?.admin === true,
    isOwner: authUser.customClaims?.owner === true,
  };
}

export { Timestamp, TRIAL_DAYS };

/** Server-only log of every admin action. Like adminPrivate, no Firestore rule matches it, so clients can never read it. */
export const ADMIN_AUDIT_COLLECTION = "adminAudit";

/** One entry in the history log. "admin" = something an admin did; "system" = something a customer or the app did. */
export type HistoryKind = "admin" | "system";

async function writeHistory(
  kind: HistoryKind,
  actor: { uid: string; email?: string | null },
  action: string,
  targetUid: string | null,
  details: Record<string, unknown>,
) {
  try {
    const { FieldValue } = await import("firebase-admin/firestore");
    await adminDb().collection(ADMIN_AUDIT_COLLECTION).add({
      kind,
      actorUid: actor.uid,
      actorEmail: actor.email ?? "",
      action,
      targetUid,
      details,
      at: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("[history] log write failed", error);
  }
}

/** Records an admin action: who did what to which account. Never throws: a logging failure must not undo the action. */
export async function audit(actor: DecodedIdToken, action: string, targetUid: string | null, details: Record<string, unknown> = {}) {
  await writeHistory("admin", actor, action, targetUid, details);
}

/** Records something a customer (or the app on their behalf) did: signup, sign-in, support message. Never throws. */
export async function logEvent(
  actor: { uid: string; email?: string | null },
  action: string,
  targetUid: string | null,
  details: Record<string, unknown> = {},
) {
  await writeHistory("system", actor, action, targetUid, details);
}
