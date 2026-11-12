import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb, logEvent, requireUser } from "@/lib/admin/server";
import { createUserRecordIfMissing } from "@/lib/admin/user-record";
import { recordLogin } from "@/lib/admin/logins";

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

  const provider = (guard.token.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider ?? "";
  const loginMethod = provider === "google.com" ? "Google" : provider === "password" ? "Email & password" : provider || "Unknown";

  if (await createUserRecordIfMissing(authUser)) {
    // A new account's first visit is also its first sign-in.
    await recordLogin(request, uid, loginMethod);
    await ref.update({ lastSignInSeen: authUser.metadata.lastSignInTime ?? "" });
    await logEvent({ uid, email: authUser.email }, "account_created", uid, {
      method: authUser.providerData.map((p) => p.providerId).join(", "),
    });
  } else {
    const snap = await ref.get();
    // This route runs on every app load, so a sign-in is recorded when the person comes back after 30 quiet minutes, or
    // whenever Firebase reports a genuinely new sign-in (signing out and back in) — so two logins in one day are both kept.
    const last = snap.data()?.lastLogin;
    const authSignIn = authUser.metadata.lastSignInTime ?? "";
    const newSignIn = authSignIn !== "" && snap.data()?.lastSignInSeen !== authSignIn;
    if (newSignIn || !(last instanceof Timestamp) || Date.now() - last.toMillis() > 30 * 60_000) {
      await recordLogin(request, uid, loginMethod);
    }
    await ref.update({
      lastLogin: FieldValue.serverTimestamp(),
      lastSignInSeen: authSignIn,
      email: authUser.email ?? "",
      ...(authUser.displayName ? { name: authUser.displayName } : {}),
    });
  }
  return NextResponse.json({ ok: true, claimsUpdated });
}
