import "server-only";
import { adminAuth } from "@/lib/admin/server";

/**
 * Sends Firebase's own account emails (password reset, email verification) using the templates and sender configured in
 * Firebase Console → Authentication → Templates. No Resend domain is needed for these.
 */
const API = "https://identitytoolkit.googleapis.com/v1";

function apiKey() {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY isn't set.");
  return key;
}

async function call(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${API}/${path}?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Firebase couldn't send the email (${data?.error?.message ?? response.status}).`);
  return data;
}

export async function sendPasswordResetEmail(email: string) {
  await call("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email });
}

/** Verification emails need the user's own ID token, so mint a short-lived one from a custom token. */
export async function sendVerificationEmail(uid: string) {
  const customToken = await adminAuth().createCustomToken(uid);
  const { idToken } = await call("accounts:signInWithCustomToken", { token: customToken, returnSecureToken: true });
  await call("accounts:sendOobCode", { requestType: "VERIFY_EMAIL", idToken });
}
