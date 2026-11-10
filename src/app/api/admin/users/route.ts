import { NextResponse } from "next/server";
import type { UserRecord } from "firebase-admin/auth";
import { accountForAuthUser, adminAuth, adminDb, requireAdmin, summarize } from "@/lib/admin/server";
import type { AdminUserSummary } from "@/lib/account-status";

/** Every account, joined with its `users` doc and shop name. Owner only. */
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const authUsers: UserRecord[] = [];
    let pageToken: string | undefined;
    do {
      const page = await adminAuth().listUsers(1000, pageToken);
      authUsers.push(...page.users);
      pageToken = page.pageToken;
    } while (pageToken);

    const db = adminDb();
    const userRefs = authUsers.map((u) => db.collection("users").doc(u.uid));
    const settingsRefs = authUsers.map((u) => db.collection("settings").doc(u.uid));
    const [userSnaps, settingsSnaps] = authUsers.length
      ? await Promise.all([db.getAll(...userRefs), db.getAll(...settingsRefs)])
      : [[], []];

    const users: AdminUserSummary[] = authUsers.map((u, i) => {
      const shopName = settingsSnaps[i].data()?.shopName;
      const account = accountForAuthUser(u, userSnaps[i].data());
      // Auth is the source of truth for a blocked login, even before a users doc exists.
      account.disabled = account.disabled || u.disabled;
      return summarize(u, account, typeof shopName === "string" ? shopName : "");
    });
    return NextResponse.json({ users });
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Couldn't load users.";
  return NextResponse.json({ error: message }, { status: error instanceof Error && error.name === "AdminConfigError" ? 503 : 500 });
}
