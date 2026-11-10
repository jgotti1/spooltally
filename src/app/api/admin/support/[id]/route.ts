import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";
import { adminDb, audit, requireAdmin } from "@/lib/admin/server";
import { toSupportMessage } from "@/lib/admin/support";

/**
 * Reply to a support message (emails the customer and appends the reply) and/or mark it open or resolved.
 * Body: { reply?: string, status?: "open" | "resolved" }. A reply resolves the message unless status says otherwise.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/support/[id]">) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  let body: { reply?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const { id } = await ctx.params;
    const ref = adminDb().collection("supportMessages").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "That message no longer exists." }, { status: 404 });
    const current = toSupportMessage(id, snap.data()!);

    const update: Record<string, unknown> = {};
    const reply = typeof body.reply === "string" ? body.reply.trim().slice(0, 5000) : "";

    if (reply) {
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.RESEND_FROM;
      if (!apiKey || !from) {
        // Resend's shared test sender only delivers to the Resend account's own address, so replies need a real domain.
        return NextResponse.json(
          { error: "Replies need RESEND_API_KEY and RESEND_FROM (an address on a domain verified in Resend). Add them and redeploy." },
          { status: 503 },
        );
      }
      const original = current.message.split("\n").map((line) => `> ${line}`).join("\n");
      const { error } = await new Resend(apiKey).emails.send({
        from,
        to: current.email,
        subject: "Re: your SpoolTally support request",
        text: `Hi ${current.name || "there"},\n\n${reply}\n\n— SpoolTally Support\n\nTo follow up, use the Contact page in SpoolTally.\n\n${original}`,
      });
      if (error) {
        console.error("Resend reply error:", error);
        return NextResponse.json({ error: "The email didn't send, so the reply wasn't saved. Try again shortly." }, { status: 502 });
      }
      update.replies = FieldValue.arrayUnion({ message: reply, at: new Date().toISOString(), byEmail: guard.token.email ?? "" });
      update.status = "resolved";
    }
    if (body.status === "open" || body.status === "resolved") update.status = body.status;
    if (!Object.keys(update).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

    update.updatedAt = FieldValue.serverTimestamp();
    await ref.update(update);

    if (reply) await audit(guard.token, "support_reply", current.ownerId, { messageId: id });
    else if (update.status !== current.status) {
      await audit(guard.token, update.status === "resolved" ? "support_resolved" : "support_reopened", current.ownerId, { messageId: id });
    }
    const fresh = await ref.get();
    return NextResponse.json({ message: toSupportMessage(id, fresh.data()!) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: 500 });
  }
}
