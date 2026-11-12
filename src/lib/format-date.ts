/** "Added Nov 12, 2026" for a Firestore creation timestamp. Empty while a brand-new document's server time is still pending. */
export function addedLabel(createdAt: { toDate(): Date } | null | undefined): string {
  if (!createdAt) return "";
  return `Added ${createdAt.toDate().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
}
