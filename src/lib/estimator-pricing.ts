import type { Roll } from "@/lib/rolls";
import type { EstimateColorUsage } from "@/lib/estimates";
import type { EstimatorSettings } from "@/lib/estimator-settings";
import type { ChannelFeeProfile } from "@/lib/estimator-constants";

/** Used for filament cost whenever a color has no linked roll, or its roll has no price set — a guess so the estimate isn't silently $0, not a real number. */
export const DEFAULT_ROLL_PRICE = 20;
const DEFAULT_ROLL_SIZE_GRAMS = 1000;
const DEFAULT_COST_PER_GRAM = DEFAULT_ROLL_PRICE / DEFAULT_ROLL_SIZE_GRAMS;

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
  colorsUsed: EstimateColorUsage[],
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
  colorsUsed: EstimateColorUsage[],
  rollsById: Map<string, Roll>,
  printHours: number,
  quantity: number,
  settings: EstimatorSettings,
  slicerFilamentCost?: number | null,
): CostBreakdown {
  const usedSlicerFilamentCost = slicerFilamentCost !== null && slicerFilamentCost !== undefined && slicerFilamentCost > 0;
  const { cost: calculatedFilamentCost, defaultedColors } = calcFilamentCost(colorsUsed, rollsById);
  const filamentCost = usedSlicerFilamentCost ? slicerFilamentCost : calculatedFilamentCost;
  const machineCost = printHours * settings.machineRatePerHour;
  const electricityCost = printHours * settings.electricityRatePerHour;
  const laborCost = printHours * settings.laborRatePerHour;
  const packagingCost = settings.packagingCost;
  const shippingCost = settings.shippingCost;
  const subtotal = filamentCost + machineCost + electricityCost + laborCost + packagingCost + shippingCost;
  const failureBuffer = subtotal * (settings.failureBufferPercent / 100);
  const totalCost = subtotal + failureBuffer;
  const units = Math.max(1, quantity);
  return {
    filamentCost,
    machineCost,
    electricityCost,
    laborCost,
    packagingCost,
    shippingCost,
    failureBuffer,
    totalCost,
    costPerUnit: totalCost / units,
    defaultedColors: usedSlicerFilamentCost ? [] : defaultedColors,
    usedSlicerFilamentCost,
  };
}

/** price = (cost + target profit + fixed fees) / (1 - fee %) */
export function calcSuggestedPrice(costPerUnit: number, targetProfitPercent: number, channel: ChannelFeeProfile): number {
  const targetProfit = costPerUnit * (targetProfitPercent / 100);
  const fixedFees = channel.fixedFee + channel.processingFixed;
  const feePercent = channel.percentFee + channel.processingPercent;
  const denom = 1 - feePercent / 100;
  if (denom <= 0) return Infinity;
  return (costPerUnit + targetProfit + fixedFees) / denom;
}
