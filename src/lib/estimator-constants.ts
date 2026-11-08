export type SalesChannelId =
  | "etsy"
  | "ebay"
  | "amazon_handmade"
  | "own_site"
  | "facebook_marketplace"
  | "in_person"
  | "custom";

export type ChannelFeeProfile = {
  id: SalesChannelId;
  label: string;
  /** Platform/marketplace fee, percent of sale price. */
  percentFee: number;
  /** Platform flat fee per order. */
  fixedFee: number;
  /** Payment processing fee, percent of sale price (card reader fee for in-person). */
  processingPercent: number;
  /** Payment processing flat fee per order (booth fee for in-person). */
  processingFixed: number;
};

export const DEFAULT_CHANNELS: ChannelFeeProfile[] = [
  { id: "etsy", label: "Etsy", percentFee: 6.5, fixedFee: 0.2, processingPercent: 3, processingFixed: 0.25 },
  { id: "ebay", label: "eBay / auction", percentFee: 13, fixedFee: 0, processingPercent: 2.9, processingFixed: 0.3 },
  { id: "amazon_handmade", label: "Amazon Handmade", percentFee: 15, fixedFee: 0, processingPercent: 0, processingFixed: 0 },
  { id: "own_site", label: "Own site", percentFee: 0, fixedFee: 0, processingPercent: 2.9, processingFixed: 0.3 },
  { id: "facebook_marketplace", label: "Facebook Marketplace", percentFee: 5, fixedFee: 0, processingPercent: 0, processingFixed: 0 },
  { id: "in_person", label: "In person / local sale", percentFee: 0, fixedFee: 0, processingPercent: 0, processingFixed: 0 },
  { id: "custom", label: "Custom", percentFee: 0, fixedFee: 0, processingPercent: 0, processingFixed: 0 },
];

export const DEFAULT_FAILURE_BUFFER_PERCENT = 10;
export const DEFAULT_TARGET_PROFIT_PERCENT = 40;
