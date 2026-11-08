export const BRAND_OPTIONS = [
  "Atomic",
  "Bambu Lab",
  "Creality",
  "Elegoo",
  "eSun",
  "Hatchbox",
  "Inland",
  "Jayo",
  "Jdhojor",
  "Kingroon",
  "Overture",
  "Polymaker",
  "Protopasta",
  "Prusament",
  "Sunlu",
] as const;

export const MATERIAL_OPTIONS = [
  "PLA",
  "PLA+",
  "PETG",
  "ABS",
  "ASA",
  "TPU",
  "Nylon",
  "PC",
  "PVA",
] as const;

export const COLOR_OPTIONS = [
  "Black",
  "White",
  "Gray",
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Pink",
  "Brown",
  "Natural / Clear",
  "Gold",
  "Silver",
] as const;

export const SIZE_OPTIONS_GRAMS = [750, 1000, 2000, 5000] as const;

export const ROLL_LEVELS = ["full", "3/4", "1/2", "1/4", "empty"] as const;
export type RollLevel = (typeof ROLL_LEVELS)[number];

export const ROLL_LEVEL_LABELS: Record<RollLevel, string> = {
  full: "Full",
  "3/4": "3/4",
  "1/2": "1/2",
  "1/4": "1/4",
  empty: "Empty",
};

export const ROLL_LEVEL_FRACTIONS: Record<RollLevel, number> = {
  full: 1,
  "3/4": 0.75,
  "1/2": 0.5,
  "1/4": 0.25,
  empty: 0,
};

export const CUSTOM_OPTION = "Other (custom)";

export function gramsForLevel(level: RollLevel, sizeGrams: number, quantity: number): number {
  return ROLL_LEVEL_FRACTIONS[level] * sizeGrams * (level === "full" ? quantity : 1);
}
