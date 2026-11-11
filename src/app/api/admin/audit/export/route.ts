import { NextResponse } from "next/server";
import { audit, requireAdmin } from "@/lib/admin/server";
import { parseKind, scanHistory } from "@/lib/admin/history";
import { AUDIT_LABELS } from "@/lib/account-status";

/** Spreadsheet apps run text that starts with = + - @ as a formula, so those cells are prefixed with an apostrophe. */
function cell(value: unknown): string {
  let text = typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** CSV download of the history log (admins only). `?kind=` and `?days=` narrow it; capped at 50,000 rows. */
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const params = new URL(request.url).searchParams;
    const kind = parseKind(params.get("kind"));
    const days = Number(params.get("days")) || null;
    const { entries } = await scanHistory({ kind, limit: 50_000, sinceDays: days });

    const rows = [["Time (UTC)", "Type", "Event", "Who", "Account ID", "Details"].map(cell).join(",")];
    for (const e of entries) {
      rows.push(
        [e.at, e.kind === "system" ? "User activity" : "Admin action", AUDIT_LABELS[e.action] ?? e.action, e.actorEmail || e.actorUid, e.targetUid, e.details]
          .map(cell)
          .join(","),
      );
    }
    await audit(guard.token, "export_history", null, { rows: entries.length, kind, days });
    return new NextResponse(rows.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="spooltally-history-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't export the history." }, { status: 500 });
  }
}
