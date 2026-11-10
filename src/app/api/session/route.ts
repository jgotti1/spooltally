import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { TRIAL_DAYS } from "@/lib/account-status";
import { adminAuth, adminDb, requireUser } from "@/lib/admin/server";

/**
 * Called once per app load while signed in. Creates the `users/{uid}` doc the first time (trial starts at the Auth
 * account's creation time) and records the last-active time. Done server-side so users can never edit their own
 * trial, plan or comp flags — the Firestore rules make `users` read-only to the client.
 */
export async function POST(request: Request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  const uid = guard.token.uid;
  const authUser = await adminAuth().getUser(uid);

  // First sign-in of the owner: grant `admin` + `owner` without a manual script. OWNER_EMAIL is a server-only env var
  // (never sent to the browser), and the token's email must be verified so nobody can claim it by registering the address.
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  let claimsUpdated = false;
  if (
    ownerEmail &&
    guard.token.email_verified === true &&
    guard.token.email?.toLowerCase() === ownerEmail &&
    !(guard.token.admin === true && guard.token.owner === true)
  ) {
    await adminAuth().setCustomUserClaims(uid, { ...(authUser.customClaims ?? {}), admin: true, owner: true });
    claimsUpdated = true;
  }
  const ref = adminDb().collection("users").doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    const created = new Date(authUser.metadata.creationTime);
    await ref.set({
      name: authUser.displayName ?? "",
      email: authUser.email ?? "",
      createdAt: Timestamp.fromDate(created),
      trialEndsAt: Timestamp.fromDate(new Date(created.getTime() + TRIAL_DAYS * 86_400_000)),
      plan: "trial",
      isComped: false,
      compNote: "",
      disabled: false,
      subscriptionStatus: "",
      adminNotes: "",
      lastLogin: FieldValue.serverTimestamp(),
    });
  } else {
    await ref.update({
      lastLogin: FieldValue.serverTimestamp(),
      email: authUser.email ?? "",
      ...(authUser.displayName ? { name: authUser.displayName } : {}),
    });
  }
  return NextResponse.json({ ok: true, claimsUpdated });
}
