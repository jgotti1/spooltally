import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";
import { adminDb, logEvent, requireUser } from "@/lib/admin/server";

// Server-only: never sent to the browser.
const SUPPORT_EMAIL = "jgotti711@gmail.com";

/**
 * Saves the message to `supportMessages` (the admin support inbox) and emails a copy to the owner.
 * The inbox copy is the record; the email is a notification, so a failed email doesn't lose the message.
 *
 * Open to signed-out visitors too, because a frozen account can't sign in and still needs a way to reach support. A
 * signed-in sender is tied to their account; anyone else is saved as a public message.
 */
export async function POST(request: Request) {
  let ownerId = "";
  let senderEmail: string | null = null;
  if (request.headers.get("authorization")) {
    const guard = await requireUser(request);
    if (!guard.ok) return guard.response;
    ownerId = guard.token.uid;
    senderEmail = guard.token.email ?? null;
  }

  let body: { name?: string; email?: string; message?: string; website?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Hidden form field that only bots fill in: pretend it worked and drop it.
  if (body.website) return NextResponse.json({ ok: true });

  const name = body.name?.trim().slice(0, 200) ?? "";
  const email = body.email?.trim().slice(0, 320) ?? "";
  const message = body.message?.trim().slice(0, 5000) ?? "";

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email, and message are all required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  try {
    const created = await adminDb().collection("supportMessages").add({
      ownerId,
      public: ownerId === "",
      name,
      email,
      message,
      status: "open",
      replies: [],
      createdAt: FieldValue.serverTimestamp(),
    });
    await logEvent({ uid: ownerId || "public", email: senderEmail ?? email }, "support_message", ownerId || null, {
      messageId: created.id,
      ...(ownerId ? {} : { public: true }),
    });
  } catch (error) {
    console.error("Saving support message failed:", error);
    return NextResponse.json({ error: "Couldn't send your message. Please try again shortly." }, { status: 500 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const { error } = await new Resend(apiKey).emails.send({
      from: process.env.RESEND_FROM || "SpoolTally Support <onboarding@resend.dev>",
      to: SUPPORT_EMAIL,
      replyTo: email,
      subject: `SpoolTally support request from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}\n\nReply from the admin Support inbox in SpoolTally.`,
    });
    if (error) console.error("Resend error (message is still saved in the inbox):", error);
  }

  return NextResponse.json({ ok: true });
}
