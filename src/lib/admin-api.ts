import type { AdminAction, AdminUserDetail, AdminUserPatch, AdminUserSummary, AuditEntry, SupportMessage, SupportStatus } from "@/lib/account-status";

type TokenGetter = () => Promise<string | null>;

async function adminRequest<T>(getIdToken: TokenGetter, path: string, init?: RequestInit): Promise<T> {
  const token = await getIdToken();
  if (!token) throw new Error("Not signed in.");
  const response = await fetch(path, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Request failed.");
  return body as T;
}

export async function fetchAdminUsers(getIdToken: TokenGetter): Promise<AdminUserSummary[]> {
  return (await adminRequest<{ users: AdminUserSummary[] }>(getIdToken, "/api/admin/users")).users;
}

export async function fetchAdminUser(getIdToken: TokenGetter, uid: string): Promise<AdminUserDetail> {
  return (await adminRequest<{ user: AdminUserDetail }>(getIdToken, `/api/admin/users/${encodeURIComponent(uid)}`)).user;
}

export async function updateAdminUser(getIdToken: TokenGetter, uid: string, patch: AdminUserPatch): Promise<AdminUserDetail> {
  return (
    await adminRequest<{ user: AdminUserDetail }>(getIdToken, `/api/admin/users/${encodeURIComponent(uid)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    })
  ).user;
}

export async function deleteAdminUser(getIdToken: TokenGetter, uid: string, confirm: string): Promise<void> {
  await adminRequest<{ ok: true }>(getIdToken, `/api/admin/users/${encodeURIComponent(uid)}`, {
    method: "DELETE",
    body: JSON.stringify({ confirm }),
  });
}

export async function runAdminAction(getIdToken: TokenGetter, uid: string, action: AdminAction): Promise<void> {
  await adminRequest<{ ok: true }>(getIdToken, `/api/admin/users/${encodeURIComponent(uid)}/actions`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function fetchAuditLog(getIdToken: TokenGetter, uid?: string): Promise<AuditEntry[]> {
  const query = uid ? `?uid=${encodeURIComponent(uid)}` : "";
  return (await adminRequest<{ entries: AuditEntry[] }>(getIdToken, `/api/admin/audit${query}`)).entries;
}

export async function fetchSupportMessages(getIdToken: TokenGetter, uid?: string): Promise<SupportMessage[]> {
  const query = uid ? `?uid=${encodeURIComponent(uid)}` : "";
  return (await adminRequest<{ messages: SupportMessage[] }>(getIdToken, `/api/admin/support${query}`)).messages;
}

export async function updateSupportMessage(
  getIdToken: TokenGetter,
  id: string,
  change: { reply?: string; status?: SupportStatus },
): Promise<SupportMessage> {
  return (
    await adminRequest<{ message: SupportMessage }>(getIdToken, `/api/admin/support/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(change),
    })
  ).message;
}

export type HistoryKindFilter = "all" | "admin" | "system";

export async function fetchHistoryPage(
  getIdToken: TokenGetter,
  opts: { kind: HistoryKindFilter; cursor?: string | null },
): Promise<{ entries: AuditEntry[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ kind: opts.kind, limit: "100" });
  if (opts.cursor) params.set("cursor", opts.cursor);
  return adminRequest(getIdToken, `/api/admin/audit?${params}`);
}

/** Downloads the log as a CSV file through the browser. */
export async function downloadHistory(getIdToken: TokenGetter, kind: HistoryKindFilter, days: number | null): Promise<void> {
  const token = await getIdToken();
  if (!token) throw new Error("Not signed in.");
  const params = new URLSearchParams({ kind });
  if (days) params.set("days", String(days));
  const response = await fetch(`/api/admin/audit/export?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.error === "string" ? body.error : "Couldn't export the history.");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `spooltally-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function purgeHistory(getIdToken: TokenGetter, olderThanDays: number | null, confirm: string): Promise<number> {
  const result = await adminRequest<{ deleted: number }>(getIdToken, "/api/admin/audit", {
    method: "DELETE",
    body: JSON.stringify({ confirm, ...(olderThanDays ? { olderThanDays } : {}) }),
  });
  return result.deleted;
}
