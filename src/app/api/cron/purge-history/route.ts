import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { logEvent } from "@/lib/admin/server";
import { HISTORY_RETENTION_DAYS, purgeHistoryOlderThan } from "@/lib/admin/history";
import { LOGIN_RETENTION_DAYS, purgeLoginsOlderThan } from "@/lib/admin/logins";

function validSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // not configured: refuse everyone rather than leave the route open
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily retention job (scheduled in vercel.json): deletes history older than HISTORY_RETENTION_DAYS. Vercel Cron calls
 * this with `Authorization: Bearer $CRON_SECRET`, so it needs the CRON_SECRET environment variable. A run is only
 * written to the history when it actually removed something.
 */
export async function GET(request: Request) {
  if (!validSecret(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const deleted = await purgeHistoryOlderThan(HISTORY_RETENTION_DAYS);
    if (deleted > 0) {
      await logEvent({ uid: "system", email: "automatic cleanup" }, "purge_history", null, { deleted, olderThanDays: HISTORY_RETENTION_DAYS, automatic: true });
    }
    const loginsDeleted = await purgeLoginsOlderThan(LOGIN_RETENTION_DAYS);
    return NextResponse.json({ ok: true, deleted, loginsDeleted });
  } catch (error) {
    console.error("[history] retention purge failed", error);
    return NextResponse.json({ error: "Purge failed." }, { status: 500 });
  }
}
