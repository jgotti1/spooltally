import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/server";
import { listLogins } from "@/lib/admin/logins";

/** One account's sign-in history for the last 60 days. Admins only. */
export async function GET(request: Request, ctx: { params: Promise<{ uid: string }> }) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  try {
    const { uid } = await ctx.params;
    return NextResponse.json({ logins: await listLogins(uid) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't load sign-ins." }, { status: 500 });
  }
}
