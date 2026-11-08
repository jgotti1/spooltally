import * as XLSX from "xlsx";
import type { Roll } from "@/lib/rolls";
import { ROLL_LEVEL_LABELS } from "@/lib/inventory-constants";
import type { StockGroup } from "@/lib/inventory-status";

/** Downloads the given rolls as an .xlsx workbook named with today's date. */
export function exportRollsToExcel(rolls: Roll[]) {
  const rows = rolls.map((r) => ({
    Brand: r.brand,
    Material: r.material,
    Color: r.color,
    "Size (g)": r.sizeGrams,
    Level: ROLL_LEVEL_LABELS[r.level],
    Quantity: r.quantity,
    "Grams remaining": Math.round(r.remainingGrams),
    "Price paid": r.price,
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Filament rolls");

  const dateStamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `spooltally-inventory-${dateStamp}.xlsx`);
}

/** Downloads the given reorder-report groups as an .xlsx workbook named with today's date. */
export function exportReorderReportToExcel(groups: StockGroup[]) {
  const rows = groups.map((g) => ({
    Brand: g.brand,
    Material: g.material,
    Color: g.color,
    "Rolls remaining (approx.)": Number(g.rollsEquivalent.toFixed(2)),
    "Grams remaining": Math.round(g.totalGrams),
    Status: g.status === "reorder" ? "Reorder now" : "Low — order soon",
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Reorder report");

  const dateStamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `spooltally-reorder-report-${dateStamp}.xlsx`);
}
