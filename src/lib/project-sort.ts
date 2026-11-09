import type { Project } from "@/lib/projects";

export const PROJECT_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "status", label: "Status (Active → Archived)" },
] as const;

export type ProjectSortOption = (typeof PROJECT_SORT_OPTIONS)[number]["value"];

const STATUS_ORDER = { Active: 0, Archived: 1 };

export function sortProjects(projects: Project[], sortBy: ProjectSortOption): Project[] {
  const sorted = [...projects];
  switch (sortBy) {
    case "newest":
      sorted.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      break;
    case "oldest":
      sorted.sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
      break;
    case "name-asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name-desc":
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "status":
      sorted.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
      break;
  }
  return sorted;
}
