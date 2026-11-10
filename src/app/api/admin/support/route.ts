import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/admin/server";
import { toSupportMessage } from "@/lib/admin/support";

/** Support inbox, newest first. `?uid=` narrows it to one customer. */
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  try {
    const uid = new URL(request.url).searchParams.get("uid");
    const col = adminDb().collection("supportMessages");
    const snap = uid ? await col.where("ownerId", "==", uid).limit(500).get() : await col.orderBy("createdAt", "desc").limit(300).get();
    const messages = snap.docs
      .map((doc) => toSupportMessage(doc.id, doc.data()))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't load support messages." }, { status: 500 });
  }
}
