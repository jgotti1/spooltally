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
