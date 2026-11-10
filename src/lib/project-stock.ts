import type { Project, ProjectColorNeed } from "@/lib/projects";
import type { Roll } from "@/lib/rolls";

/** How one color of a project compares against what's on hand. Fractions are rough, so "short" means "may run short". */
export type ColorStock = {
  material: string;
  color: string;
  /** Grams for one full batch (grams needed × batch quantity). */
  gramsNeeded: number;
  /** Grams on hand across every roll of the same material + color (same-color rolls count together). */
  gramsOnHand: number;
  short: boolean;
  /** Whole units printable from the current stock, or null when grams needed isn't known. */
  unitsPossible: number | null;
};

function stockKey(material: string, color: string): string {
  return `${material.trim().toLowerCase()}__${color.trim().toLowerCase()}`;
}

/** Grams on hand per material + color, so each project color is checked against everything that matches it. */
export function gramsOnHandByColor(rolls: Roll[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const roll of rolls) {
    const key = stockKey(roll.material, roll.color);
    totals.set(key, (totals.get(key) ?? 0) + roll.remainingGrams);
  }
  return totals;
}

function colorStock(need: ProjectColorNeed, quantity: number, onHand: Map<string, number>): ColorStock {
  const perUnit = need.gramsNeeded ?? 0;
  const gramsNeeded = perUnit * Math.max(1, quantity);
  const gramsOnHand = onHand.get(stockKey(need.material, need.color)) ?? 0;
  return {
    material: need.material,
    color: need.color,
    gramsNeeded,
    gramsOnHand,
    short: gramsNeeded > 0 ? gramsOnHand < gramsNeeded : gramsOnHand <= 0,
    unitsPossible: perUnit > 0 ? Math.floor(gramsOnHand / perUnit) : null,
  };
}

export type ProjectStock = {
  colors: ColorStock[];
  /** True when any color may run short for one full batch. */
  short: boolean;
  /** Fewest whole units printable across all colors, or null when no color has a known grams figure. */
  unitsPossible: number | null;
};

/** Checks a project's colors against current stock: what may run short, and how many more units the shop can print. */
export function projectStock(project: Pick<Project, "colorsNeeded" | "quantity">, rolls: Roll[]): ProjectStock {
  const onHand = gramsOnHandByColor(rolls);
  const colors = project.colorsNeeded.map((need) => colorStock(need, project.quantity, onHand));
  const known = colors.map((c) => c.unitsPossible).filter((units): units is number => units !== null);
  return {
    colors,
    short: colors.some((c) => c.short),
    unitsPossible: known.length > 0 ? Math.min(...known) : null,
  };
}

/** One-line summary of what a project is short on, e.g. "Green PLA: need 400 g, ~250 g on hand". */
export function describeShortage(stock: ProjectStock): string {
  return stock.colors
    .filter((c) => c.short)
    .map((c) => `${c.color} ${c.material}: need ${Math.round(c.gramsNeeded)} g, ~${Math.round(c.gramsOnHand)} g on hand`)
    .join(" · ");
}
