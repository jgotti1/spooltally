import * as XLSX from "xlsx";
import type { Roll } from "@/lib/rolls";
import { ROLL_LEVEL_LABELS } from "@/lib/inventory-constants";

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
