import type { Roll } from "@/lib/rolls";

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "brand", label: "Brand (A–Z)" },
  { value: "color", label: "Color (A–Z)" },
  { value: "material", label: "Material (A–Z)" },
  { value: "grams-asc", label: "Grams remaining (low to high)" },
  { value: "grams-desc", label: "Grams remaining (high to low)" },
  { value: "price-asc", label: "Price (low to high)" },
  { value: "price-desc", label: "Price (high to low)" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export function sortRolls(rolls: Roll[], sortBy: SortOption): Roll[] {
  const sorted = [...rolls];
  switch (sortBy) {
    case "newest":
      sorted.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      break;
    case "oldest":
      sorted.sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
      break;
    case "brand":
      sorted.sort((a, b) => a.brand.localeCompare(b.brand));
      break;
    case "color":
      sorted.sort((a, b) => a.color.localeCompare(b.color));
      break;
    case "material":
      sorted.sort((a, b) => a.material.localeCompare(b.material));
      break;
    case "grams-asc":
      sorted.sort((a, b) => a.remainingGrams - b.remainingGrams);
      break;
    case "grams-desc":
      sorted.sort((a, b) => b.remainingGrams - a.remainingGrams);
      break;
    case "price-asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
  }
  return sorted;
}
