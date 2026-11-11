import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { TRIAL_DAYS } from "@/lib/account-status";
import { adminDb } from "@/lib/admin/server";

type AuthLike = { uid: string; email?: string; displayName?: string; metadata: { creationTime: string } };

/**
 * Creates `users/{uid}` with the starting trial the first time an account is seen, and does nothing if it already
 * exists. `create()` fails atomically on an existing doc, so two requests racing (the session ping and a privacy
 * acknowledgment right after signup) can never overwrite each other's fields. Returns true only for the caller that
 * actually created it.
 */
export async function createUserRecordIfMissing(authUser: AuthLike, extra: Record<string, unknown> = {}): Promise<boolean> {
  const created = new Date(authUser.metadata.creationTime);
  try {
    await adminDb()
      .collection("users")
      .doc(authUser.uid)
      .create({
        name: authUser.displayName ?? "",
        email: authUser.email ?? "",
        createdAt: Timestamp.fromDate(created),
        trialEndsAt: Timestamp.fromDate(new Date(created.getTime() + TRIAL_DAYS * 86_400_000)),
        plan: "trial",
        isComped: false,
        disabled: false,
        subscriptionStatus: "",
        lastLogin: FieldValue.serverTimestamp(),
        ...extra,
      });
    return true;
  } catch (error) {
    // gRPC ALREADY_EXISTS: someone else created it first.
    if ((error as { code?: number }).code === 6) return false;
    throw error;
  }
}
