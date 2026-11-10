import { NextResponse } from "next/server";
import { adminAuth, audit, requireAdmin } from "@/lib/admin/server";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/admin/firebase-email";
import type { AdminAction } from "@/lib/account-status";

/** One-off account actions that aren't stored fields: account emails, marking an email verified, and logging view-as. */
export async function POST(request: Request, ctx: RouteContext<"/api/admin/users/[uid]/actions">) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  let action: AdminAction | undefined;
  try {
    action = (await request.json())?.action;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const { uid } = await ctx.params;
    const authUser = await adminAuth().getUser(uid);
    const hasPassword = authUser.providerData.some((p) => p.providerId === "password");

    switch (action) {
      case "password_reset":
        if (!authUser.email || !hasPassword) {
          return NextResponse.json({ error: "This account signs in with Google, so it has no password to reset." }, { status: 400 });
        }
        await sendPasswordResetEmail(authUser.email);
        break;
      case "send_verification":
        if (!authUser.email) return NextResponse.json({ error: "This account has no email address." }, { status: 400 });
        if (authUser.emailVerified) return NextResponse.json({ error: "Their email is already verified." }, { status: 400 });
        await sendVerificationEmail(uid);
        break;
      case "mark_verified":
        await adminAuth().updateUser(uid, { emailVerified: true });
        break;
      case "view_as":
        // Nothing to change; this just puts the view-as session on the record.
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    await audit(guard.token, action, uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "auth/user-not-found") return NextResponse.json({ error: "No such user." }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: 500 });
  }
}
