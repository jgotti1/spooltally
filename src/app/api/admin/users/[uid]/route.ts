import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { deleteLoginsFor } from "@/lib/admin/logins";
import { ADMIN_PRIVATE_COLLECTION, accountForAuthUser, adminAuth, adminBucket, adminDb, audit, requireAdmin, requireOwner, summarize } from "@/lib/admin/server";
import { TRIAL_DAYS, type AdminUserDetail, type AdminUserPatch } from "@/lib/account-status";

async function loadDetail(uid: string): Promise<AdminUserDetail> {
  const db = adminDb();
  const authUser = await adminAuth().getUser(uid);
  const [userSnap, settingsSnap, privateSnap] = await db.getAll(
    db.collection("users").doc(uid),
    db.collection("settings").doc(uid),
    db.collection(ADMIN_PRIVATE_COLLECTION).doc(uid),
  );
  const account = accountForAuthUser(authUser, userSnap.data());
  // Notes live in the admin-only collection; the fields on the users doc are a fallback for notes saved before the move.
  const priv = privateSnap.data();
  if (typeof priv?.compNote === "string") account.compNote = priv.compNote;
  if (typeof priv?.adminNotes === "string") account.adminNotes = priv.adminNotes;
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
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const { uid } = await ctx.params;
    if (patch.disabled === true && uid === guard.token.uid) {
      return NextResponse.json({ error: "You can't freeze your own account." }, { status: 400 });
    }
    // Only the owner may hand out free access to their own account; another admin can't comp or extend themselves.
    if (uid === guard.token.uid && guard.token.owner !== true && (patch.isComped !== undefined || patch.extendTrialDays !== undefined || patch.setTrialEndsAt !== undefined)) {
      return NextResponse.json({ error: "You can't change the free access on your own account." }, { status: 403 });
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
      await audit(guard.token, patch.isAdmin ? "grant_admin" : "remove_admin", uid);
    }
    const ref = adminDb().collection("users").doc(uid);
    const existing = await ref.get();
    const update: Record<string, unknown> = { updatedByAdminAt: FieldValue.serverTimestamp() };

    if (typeof patch.isComped === "boolean") update.isComped = patch.isComped;
    // Notes go to the admin-only collection and are removed from the users doc, which the user themselves can read.
    const privateUpdate: Record<string, unknown> = {};
    const legacyCleanup: Record<string, unknown> = {};
    if (typeof patch.compNote === "string") {
      privateUpdate.compNote = patch.compNote.trim().slice(0, 500);
      legacyCleanup.compNote = FieldValue.delete();
    }
    if (typeof patch.adminNotes === "string") {
      privateUpdate.adminNotes = patch.adminNotes.trim().slice(0, 2000);
      legacyCleanup.adminNotes = FieldValue.delete();
    }
    if (Object.keys(privateUpdate).length) {
      await adminDb().collection(ADMIN_PRIVATE_COLLECTION).doc(uid).set(privateUpdate, { merge: true });
    }
    if (typeof patch.disabled === "boolean") {
      update.disabled = patch.disabled;
      await adminAuth().updateUser(uid, { disabled: patch.disabled });
      // A frozen account is signed out everywhere, not just blocked at the next login.
      if (patch.disabled) await adminAuth().revokeRefreshTokens(uid);
    }
    if (typeof patch.extendTrialDays === "number" && patch.extendTrialDays > 0 && patch.extendTrialDays <= 365) {
      // An account with no users doc yet still has its signup trial, so extend from that rather than from today.
      const stored = accountForAuthUser(authUser, existing.data()).trialEndsAt;
      const current = stored ? new Date(stored) : new Date(0);
      const base = current.getTime() > Date.now() ? current : new Date();
      update.trialEndsAt = Timestamp.fromDate(new Date(base.getTime() + patch.extendTrialDays * 86_400_000));
    }
    if (typeof patch.setTrialEndsAt === "string") {
      const date = new Date(patch.setTrialEndsAt);
      const yearMs = 365 * 86_400_000;
      if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() - yearMs || date.getTime() > Date.now() + 3 * yearMs) {
        return NextResponse.json({ error: "Pick a trial end date within the next three years." }, { status: 400 });
      }
      update.trialEndsAt = Timestamp.fromDate(date);
    }

    if (existing.exists) {
      await ref.update({ ...update, ...legacyCleanup });
    } else {
      // Account that has never opened the app since the users doc existed: seed it so the change sticks.
      const created = new Date(authUser.metadata.creationTime);
      await ref.set({
        name: authUser.displayName ?? "",
        email: authUser.email ?? "",
        createdAt: Timestamp.fromDate(created),
        trialEndsAt: Timestamp.fromDate(new Date(created.getTime() + TRIAL_DAYS * 86_400_000)),
        plan: "trial",
        isComped: false,
        disabled: false,
        subscriptionStatus: "",
        ...update,
      });
    }

    const logged: Promise<void>[] = [];
    const log = (action: string, details?: Record<string, unknown>) => logged.push(audit(guard.token, action, uid, details));
    if (typeof patch.isComped === "boolean") log(patch.isComped ? "comp_on" : "comp_off");
    if (typeof patch.compNote === "string") log("comp_note");
    if (typeof patch.adminNotes === "string") log("notes");
    if (typeof patch.disabled === "boolean") log(patch.disabled ? "freeze" : "unfreeze");
    if (update.trialEndsAt instanceof Timestamp) {
      log(typeof patch.setTrialEndsAt === "string" ? "set_trial" : "extend_trial", {
        trialEndsAt: update.trialEndsAt.toDate().toISOString(),
        ...(typeof patch.extendTrialDays === "number" ? { days: patch.extendTrialDays } : {}),
      });
    }
    await Promise.all(logged);
    return NextResponse.json({ user: await loadDetail(uid) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Every collection that holds documents tagged with the owner's uid. */
const OWNED_COLLECTIONS = ["rolls", "projects", "printers", "maintenanceRecords", "supportMessages"];

async function deleteAllUserData(uid: string) {
  const db = adminDb();
  for (const name of OWNED_COLLECTIONS) {
    const snap = await db.collection(name).where("ownerId", "==", uid).get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }
  const batch = db.batch();
  for (const name of ["settings", "users", ADMIN_PRIVATE_COLLECTION]) batch.delete(db.collection(name).doc(uid));
  await batch.commit();
  await deleteLoginsFor(uid);
  // Uploaded models and previews live under projects/{uid}/.
  await adminBucket().deleteFiles({ prefix: `projects/${uid}/`, force: true });
}

/**
 * Permanently deletes an account: its Firestore data, uploaded files, and the Auth login. Cannot be undone.
 * The caller must retype the account's email (or its ID if it has none) so it can't happen by a stray request.
 */
export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/users/[uid]">) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  let body: { confirm?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const { uid } = await ctx.params;
    if (uid === guard.token.uid) {
      return NextResponse.json({ error: "You can't delete your own account here." }, { status: 400 });
    }
    const authUser = await adminAuth().getUser(uid);
    if (authUser.customClaims?.owner === true) {
      return NextResponse.json({ error: "The owner account can't be deleted." }, { status: 400 });
    }
    if (authUser.customClaims?.admin === true && guard.token.owner !== true) {
      return NextResponse.json({ error: "Only the owner can delete an admin." }, { status: 403 });
    }
    const expected = (authUser.email ?? authUser.uid).trim().toLowerCase();
    if (typeof body.confirm !== "string" || body.confirm.trim().toLowerCase() !== expected) {
      return NextResponse.json({ error: "Confirmation didn't match. Nothing was deleted." }, { status: 400 });
    }

    // Data first, login last: if anything fails midway the account still exists and the delete can simply be retried.
    await deleteAllUserData(uid);
    await adminAuth().deleteUser(uid);
    // The log entry outlives the account, so it keeps the email for reference.
    await audit(guard.token, "delete_account", uid, { email: authUser.email ?? "", name: authUser.displayName ?? "" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
