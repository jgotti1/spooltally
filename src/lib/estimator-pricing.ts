import type { Roll } from "@/lib/rolls";
import type { EstimatorSettings } from "@/lib/estimator-settings";
import type { ChannelFeeProfile } from "@/lib/estimator-constants";

export type ColorUsage = {
  material: string;
  color: string;
  grams: number;
  rollId: string | null;
  /** How `grams` was determined: "estimated" from an uploaded STL/3MF's geometry, "exact" from a sliced file, or unset for manual entry. */
  gramsSource?: "estimated" | "exact";
};

/** Used for filament cost whenever a color has no linked roll, or its roll has no price set — a guess so the estimate isn't silently $0, not a real number. */
export const DEFAULT_ROLL_PRICE = 20;
const DEFAULT_ROLL_SIZE_GRAMS = 1000;
const DEFAULT_COST_PER_GRAM = DEFAULT_ROLL_PRICE / DEFAULT_ROLL_SIZE_GRAMS;

/** Round a monetary value to the nearest cent before it feeds later displayed totals. */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** True when a roll has no real price to cost from — missing, or priced at $0. */
export function isUsingDefaultRollCost(roll: Roll | undefined): boolean {
  return !roll || roll.sizeGrams <= 0 || roll.price <= 0;
}

/** Cost per gram for a roll, from its purchase price and size — falls back to the default roll price when the roll has none. */
export function costPerGram(roll: Roll | undefined): number {
  if (!roll || roll.sizeGrams <= 0 || roll.price <= 0) return DEFAULT_COST_PER_GRAM;
  return roll.price / roll.sizeGrams;
}

export type DefaultedColor = { material: string; color: string; rollId: string | null };

/** Total filament cost across all colors used, based on each color's linked roll, plus which colors (if any) had to fall back to the default roll price. */
export function calcFilamentCost(
  colorsUsed: ColorUsage[],
  rollsById: Map<string, Roll>,
): { cost: number; defaultedColors: DefaultedColor[] } {
  let cost = 0;
  const defaultedColors: DefaultedColor[] = [];
  for (const c of colorsUsed) {
    const roll = c.rollId ? rollsById.get(c.rollId) : undefined;
    if (isUsingDefaultRollCost(roll)) defaultedColors.push({ material: c.material, color: c.color, rollId: c.rollId });
    cost += c.grams * costPerGram(roll);
  }
  return { cost, defaultedColors };
}

export type CostBreakdown = {
  filamentCost: number;
  machineCost: number;
  electricityCost: number;
  laborCost: number;
  packagingCost: number;
  shippingCost: number;
  subtotalCost: number;
  failureBuffer: number;
  totalCost: number;
  costPerUnit: number;
  /** Colors whose filament cost used the $20/roll default because no real roll price was available. Always empty when a slicer-reported cost override is in use. */
  defaultedColors: DefaultedColor[];
  /** True when filamentCost came from a slicer-reported total instead of being calculated from roll prices. */
  usedSlicerFilamentCost: boolean;
};

/** Total cost for the whole print batch, plus a per-unit figure once quantity is applied. `slicerFilamentCost`, when a positive number, is used as the filament cost directly instead of calculating it from roll prices — e.g. the "Cost" line a slicer like Bambu Studio already reports for the plate. */
export function calcCostBreakdown(
  colorsUsed: ColorUsage[],
  rollsById: Map<string, Roll>,
  printHours: number,
  quantity: number,
  settings: EstimatorSettings,
  slicerFilamentCost?: number | null,
): CostBreakdown {
  const usedSlicerFilamentCost = slicerFilamentCost !== null && slicerFilamentCost !== undefined && slicerFilamentCost > 0;
  const { cost: calculatedFilamentCost, defaultedColors } = calcFilamentCost(colorsUsed, rollsById);
  const filamentCost = roundCurrency(usedSlicerFilamentCost ? slicerFilamentCost : calculatedFilamentCost);
  const machineCost = roundCurrency(printHours * settings.machineRatePerHour);
  const electricityCost = roundCurrency(printHours * settings.electricityRatePerHour);
  const laborCost = roundCurrency(printHours * settings.laborRatePerHour);
  const packagingCost = roundCurrency(settings.packagingCost);
  const shippingCost = roundCurrency(settings.shippingCost);
  const subtotalCost = roundCurrency(
    filamentCost + machineCost + electricityCost + laborCost + packagingCost + shippingCost,
  );
  const failureBuffer = roundCurrency(subtotalCost * (settings.failureBufferPercent / 100));
  const totalCost = roundCurrency(subtotalCost + failureBuffer);
  const units = Math.max(1, quantity);
  return {
    filamentCost,
    machineCost,
    electricityCost,
    laborCost,
    packagingCost,
    shippingCost,
    subtotalCost,
    failureBuffer,
    totalCost,
    costPerUnit: roundCurrency(totalCost / units),
    defaultedColors: usedSlicerFilamentCost ? [] : defaultedColors,
    usedSlicerFilamentCost,
  };
}

/** Suggested prices start at 2.5× complete production cost, then add fixed fees and gross up for percentage fees. A configured markup above 150% can raise that floor. */
export function calcSuggestedPrice(costPerUnit: number, targetProfitPercent: number, channel: ChannelFeeProfile): number {
  const configuredPriceBase = costPerUnit * (1 + targetProfitPercent / 100);
  const priceBase = Math.max(costPerUnit * 2.5, configuredPriceBase);
  const fixedFees = channel.fixedFee + channel.processingFixed;
  const feePercent = channel.percentFee + channel.processingPercent;
  const denom = 1 - feePercent / 100;
  if (denom <= 0) return Infinity;
  return roundCurrency((priceBase + fixedFees) / denom);
}
