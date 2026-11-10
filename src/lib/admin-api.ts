import type { AdminUserDetail, AdminUserPatch, AdminUserSummary } from "@/lib/account-status";

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
