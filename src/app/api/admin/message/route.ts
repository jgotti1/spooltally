import { NextResponse } from "next/server";
import type { UserRecord } from "firebase-admin/auth";
import { Resend } from "resend";
import { adminAuth, audit, requireAdmin } from "@/lib/admin/server";

/**
 * Emails a message from the admin to one customer or to every customer.
 * Body: { to: "all" | "<uid>", subject: string, message: string }.
 * Every recipient gets their own separate email addressed only to them, so nobody ever sees the send list.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  let body: { to?: unknown; subject?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const to = typeof body.to === "string" ? body.to : "";
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 10000) : "";
  if (!to) return NextResponse.json({ error: "Choose who to send this to." }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "Add a subject." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Write a message." }, { status: 400 });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    const missing = [!apiKey && "RESEND_API_KEY", !from && "RESEND_FROM"].filter(Boolean).join(" and ");
    return NextResponse.json({ error: `This server is missing ${missing}. Add it in Vercel (Production) and redeploy.` }, { status: 503 });
  }

  try {
    let recipients: UserRecord[];
    if (to === "all") {
      recipients = [];
      let pageToken: string | undefined;
      do {
        const page = await adminAuth().listUsers(1000, pageToken);
        recipients.push(...page.users);
        pageToken = page.pageToken;
      } while (pageToken);
      // Frozen accounts and accounts without an email address are skipped.
      recipients = recipients.filter((u) => u.email && !u.disabled);
    } else {
      const user = await adminAuth().getUser(to).catch(() => null);
      if (!user?.email) return NextResponse.json({ error: "That user has no email address." }, { status: 404 });
      recipients = [user];
    }
    if (!recipients.length) return NextResponse.json({ error: "There is nobody to send this to." }, { status: 400 });

    const resend = new Resend(apiKey);
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < recipients.length; i += 100) {
      const chunk = recipients.slice(i, i + 100);
      const { error } = await resend.batch.send(
        chunk.map((u) => ({
          from,
          to: u.email!,
          subject,
          text: `Hi ${u.displayName?.trim() && u.displayName !== u.uid ? u.displayName.trim() : "there"},\n\n${message}\n\n— SpoolTally\n\nTo reply, use the Contact page in SpoolTally.`,
        })),
      );
      if (error) {
        console.error("Resend message error:", error);
        failed += chunk.length;
      } else {
        sent += chunk.length;
      }
    }

    if (sent > 0) {
      await audit(guard.token, "admin_message", to === "all" ? null : to, { subject, recipients: to === "all" ? sent : 1, audience: to === "all" ? "all" : "single" });
    }
    if (sent === 0) return NextResponse.json({ error: "The email didn't send. Try again shortly." }, { status: 502 });
    return NextResponse.json({ ok: true, sent, failed });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: 500 });
  }
}
