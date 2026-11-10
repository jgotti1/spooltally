import "server-only";
import { iso } from "@/lib/admin/server";
import type { SupportMessage } from "@/lib/account-status";

export function toSupportMessage(id: string, d: FirebaseFirestore.DocumentData): SupportMessage {
  return {
    id,
    ownerId: String(d.ownerId ?? ""),
    name: String(d.name ?? ""),
    email: String(d.email ?? ""),
    message: String(d.message ?? ""),
    status: d.status === "resolved" ? "resolved" : "open",
    createdAt: iso(d.createdAt),
    replies: Array.isArray(d.replies)
      ? d.replies.map((r: Record<string, unknown>) => ({ message: String(r.message ?? ""), at: iso(r.at) ?? "", byEmail: String(r.byEmail ?? "") }))
      : [],
  };
}
