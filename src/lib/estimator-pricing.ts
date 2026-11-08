import type { Roll } from "@/lib/rolls";
import type { EstimateColorUsage } from "@/lib/estimates";
import type { EstimatorSettings } from "@/lib/estimator-settings";
import type { ChannelFeeProfile } from "@/lib/estimator-constants";

/** Cost per gram for a roll, from its purchase price and size. */
export function costPerGram(roll: Roll | undefined): number {
  if (!roll || roll.sizeGrams <= 0) return 0;
  return roll.price / roll.sizeGrams;
}

/** Total filament cost across all colors used, based on each color's linked roll. */
export function calcFilamentCost(colorsUsed: EstimateColorUsage[], rollsById: Map<string, Roll>): number {
  return colorsUsed.reduce((sum, c) => {
    const roll = c.rollId ? rollsById.get(c.rollId) : undefined;
    return sum + c.grams * costPerGram(roll);
  }, 0);
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
};

/** Total cost for the whole print batch, plus a per-unit figure once quantity is applied. */
export function calcCostBreakdown(
  colorsUsed: EstimateColorUsage[],
  rollsById: Map<string, Roll>,
  printHours: number,
  quantity: number,
  settings: EstimatorSettings,
): CostBreakdown {
  const filamentCost = calcFilamentCost(colorsUsed, rollsById);
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
