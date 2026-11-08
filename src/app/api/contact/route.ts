import { NextResponse } from "next/server";
import { Resend } from "resend";

const SUPPORT_EMAIL = "jgotti711@gmail.com";

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Support email isn't configured yet. Add RESEND_API_KEY to .env.local and restart the server." },
      { status: 503 },
    );
  }

  let body: { name?: string; email?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email, and message are all required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: "SpoolTally Support <onboarding@resend.dev>",
    to: SUPPORT_EMAIL,
    replyTo: email,
    subject: `SpoolTally support request from ${name}`,
    text: `From: ${name} <${email}>\n\n${message}`,
  });

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json({ error: "Couldn't send your message. Please try again shortly." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
