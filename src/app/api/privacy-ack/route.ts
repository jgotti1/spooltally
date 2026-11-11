import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, logEvent, requireUser } from "@/lib/admin/server";
import { createUserRecordIfMissing } from "@/lib/admin/user-record";
import { PRIVACY_VERSION } from "@/lib/privacy";

/**
 * Records that the signed-in person has read and acknowledged the current privacy summary. Written server-side to
 * `users/{uid}` (clients can't write that doc), with the timestamp and version, and logged to the history.
 */
export async function POST(request: Request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  const uid = guard.token.uid;
  try {
    const authUser = await adminAuth().getUser(uid);
    const fields = { privacyVersion: PRIVACY_VERSION, privacyAcknowledgedAt: FieldValue.serverTimestamp() };

    const createdNow = await createUserRecordIfMissing(authUser, fields);
    if (createdNow) {
      await logEvent({ uid, email: authUser.email }, "account_created", uid, {
        method: authUser.providerData.map((p) => p.providerId).join(", "),
      });
    } else {
      const ref = adminDb().collection("users").doc(uid);
      const snap = await ref.get();
      if (((snap.data()?.privacyVersion as number | undefined) ?? 0) >= PRIVACY_VERSION) return NextResponse.json({ ok: true });
      await ref.update(fields);
    }
    await logEvent({ uid, email: authUser.email }, "privacy_acknowledged", uid, { version: PRIVACY_VERSION });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[privacy] acknowledgment failed", error);
    return NextResponse.json({ error: "Couldn't save that. Please try again." }, { status: 500 });
  }
}
