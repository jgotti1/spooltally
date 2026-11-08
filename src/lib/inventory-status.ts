import type { Roll } from "@/lib/rolls";
import type { InventorySettings } from "@/lib/inventory-settings";

export type StockStatus = "reorder" | "warn";

export type StockGroup = {
  key: string;
  brand: string;
  material: string;
  color: string;
  totalGrams: number;
  rollsEquivalent: number;
  status: StockStatus;
};

function groupKey(roll: Pick<Roll, "brand" | "material" | "color">) {
  return `${roll.brand}__${roll.material}__${roll.color}`;
}

/** Groups rolls by brand+material+color and flags ones at/below the user's reorder or warn thresholds. */
export function groupLowRolls(rolls: Roll[], settings: InventorySettings): StockGroup[] {
  const map = new Map<string, { brand: string; material: string; color: string; totalGrams: number; sizes: number[] }>();
  for (const roll of rolls) {
    const key = groupKey(roll);
    const entry = map.get(key) ?? { brand: roll.brand, material: roll.material, color: roll.color, totalGrams: 0, sizes: [] };
    entry.totalGrams += roll.remainingGrams;
    entry.sizes.push(roll.sizeGrams);
    map.set(key, entry);
  }

  const groups: StockGroup[] = [];
  for (const [key, entry] of map) {
    const referenceSize = entry.sizes.sort((a, b) => a - b)[Math.floor(entry.sizes.length / 2)] || 1000;
    const rollsEquivalent = entry.totalGrams / referenceSize;
    if (rollsEquivalent < settings.reorderBelowRolls) {
      groups.push({ key, brand: entry.brand, material: entry.material, color: entry.color, totalGrams: entry.totalGrams, rollsEquivalent, status: "reorder" });
    } else if (rollsEquivalent <= settings.warnAtRolls) {
      groups.push({ key, brand: entry.brand, material: entry.material, color: entry.color, totalGrams: entry.totalGrams, rollsEquivalent, status: "warn" });
    }
  }

  return groups.sort((a, b) => a.rollsEquivalent - b.rollsEquivalent);
}

/** Looks up a brand+material+color group's stock status, for coloring individual roll cards. */
export function statusByKey(groups: StockGroup[]): Map<string, StockStatus> {
  return new Map(groups.map((g) => [g.key, g.status]));
}

export { groupKey };
