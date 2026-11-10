import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { accountForAuthUser, adminAuth, adminDb, requireAdmin, requireOwner, summarize } from "@/lib/admin/server";
import type { AdminUserDetail, AdminUserPatch } from "@/lib/account-status";

async function loadDetail(uid: string): Promise<AdminUserDetail> {
  const db = adminDb();
  const authUser = await adminAuth().getUser(uid);
  const [userSnap, settingsSnap] = await db.getAll(db.collection("users").doc(uid), db.collection("settings").doc(uid));
  const account = accountForAuthUser(authUser, userSnap.data());
  account.disabled = account.disabled || authUser.disabled;
  const shopName = typeof settingsSnap.data()?.shopName === "string" ? settingsSnap.data()?.shopName : "";

  const count = async (collection: string) =>
    (await db.collection(collection).where("ownerId", "==", uid).count().get()).data().count;
  const [rolls, projects, printers, maintenanceRecords, supportMessages] = await Promise.all([
    count("rolls"),
    count("projects"),
    count("printers"),
    count("maintenanceRecords"),
    count("supportMessages"),
  ]);

  return {
    ...summarize(authUser, account, shopName),
    account,
    providers: authUser.providerData.map((p) => p.providerId),
    emailVerified: authUser.emailVerified,
    counts: { rolls, projects, printers, maintenanceRecords, supportMessages },
  };
}

function errorResponse(error: unknown) {
  const code = (error as { code?: string }).code;
  if (code === "auth/user-not-found") return NextResponse.json({ error: "No such user." }, { status: 404 });
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return NextResponse.json({ error: message }, { status: error instanceof Error && error.name === "AdminConfigError" ? 503 : 500 });
}

export async function GET(request: Request, ctx: RouteContext<"/api/admin/users/[uid]">) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  try {
    const { uid } = await ctx.params;
    return NextResponse.json({ user: await loadDetail(uid) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Owner actions on one account: comp on/off, freeze (blocks login, keeps data), extend trial, notes. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/users/[uid]">) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  let patch: AdminUserPatch;
  try {
    patch = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const { uid } = await ctx.params;
    if (patch.disabled === true && uid === guard.token.uid) {
      return NextResponse.json({ error: "You can't freeze your own account." }, { status: 400 });
    }
    const authUser = await adminAuth().getUser(uid);

    if (patch.disabled === true) {
      // The owner can never be locked out, and only the owner may freeze another admin.
      if (authUser.customClaims?.owner === true) {
        return NextResponse.json({ error: "The owner account can't be frozen." }, { status: 400 });
      }
      if (authUser.customClaims?.admin === true && guard.token.owner !== true) {
        return NextResponse.json({ error: "Only the owner can freeze an admin." }, { status: 403 });
      }
    }

    if (typeof patch.isAdmin === "boolean") {
      // Granting admin is the owner's call alone, so an admin can never promote anyone (including themselves).
      const owner = await requireOwner(request);
      if (!owner.ok) return owner.response;
      if (uid === guard.token.uid || authUser.customClaims?.owner === true) {
        return NextResponse.json({ error: "The owner's admin access can't be changed here." }, { status: 400 });
      }
      const claims = { ...(authUser.customClaims ?? {}) };
      if (patch.isAdmin) claims.admin = true;
      else delete claims.admin;
      await adminAuth().setCustomUserClaims(uid, claims);
      // Removing admin takes effect right away instead of when their current token expires.
      if (!patch.isAdmin) await adminAuth().revokeRefreshTokens(uid);
    }
    const ref = adminDb().collection("users").doc(uid);
    const existing = await ref.get();
    const update: Record<string, unknown> = { updatedByAdminAt: FieldValue.serverTimestamp() };

    if (typeof patch.isComped === "boolean") update.isComped = patch.isComped;
    if (typeof patch.compNote === "string") update.compNote = patch.compNote.trim().slice(0, 500);
    if (typeof patch.adminNotes === "string") update.adminNotes = patch.adminNotes.trim().slice(0, 2000);
    if (typeof patch.disabled === "boolean") {
      update.disabled = patch.disabled;
      await adminAuth().updateUser(uid, { disabled: patch.disabled });
      // A frozen account is signed out everywhere, not just blocked at the next login.
      if (patch.disabled) await adminAuth().revokeRefreshTokens(uid);
    }
    if (typeof patch.extendTrialDays === "number" && patch.extendTrialDays > 0 && patch.extendTrialDays <= 365) {
      const current = existing.data()?.trialEndsAt instanceof Timestamp ? existing.data()?.trialEndsAt.toDate() : new Date(0);
      const base = current.getTime() > Date.now() ? current : new Date();
      update.trialEndsAt = Timestamp.fromDate(new Date(base.getTime() + patch.extendTrialDays * 86_400_000));
    }

    if (existing.exists) {
      await ref.update(update);
    } else {
      // Account that has never opened the app since the users doc existed: seed it so the change sticks.
      const created = new Date(authUser.metadata.creationTime);
      await ref.set({
        name: authUser.displayName ?? "",
        email: authUser.email ?? "",
        createdAt: Timestamp.fromDate(created),
        trialEndsAt: Timestamp.fromDate(new Date(created.getTime() + 14 * 86_400_000)),
        plan: "trial",
        isComped: false,
        compNote: "",
        disabled: false,
        subscriptionStatus: "",
        adminNotes: "",
        ...update,
      });
    }
    return NextResponse.json({ user: await loadDetail(uid) });
  } catch (error) {
    return errorResponse(error);
  }
}
