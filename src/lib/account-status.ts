/** Shared (client + server) account model for the owner's admin tools. Dates travel as ISO strings. */

export const TRIAL_DAYS = 14;

export type AccountPlan = "trial" | "monthly" | "quarterly" | "yearly";

/** The stored `users/{uid}` document, as the admin API returns it. Billing fields are filled in by the Stripe step later. */
export type AccountRecord = {
  name: string;
  email: string;
  createdAt: string | null;
  trialEndsAt: string | null;
  plan: AccountPlan;
  /** Last time the app was opened while signed in. */
  lastLogin: string | null;
  isComped: boolean;
  compNote: string;
  /** Owner froze the account: login is blocked and nothing is deleted. */
  disabled: boolean;
  /** Mirrors Stripe's subscription status once billing is connected: active, trialing, past_due, unpaid, canceled… */
  subscriptionStatus: string;
  adminNotes: string;
  /** When the person acknowledged the privacy summary, and which version they saw. Null until they do. */
  privacyAcknowledgedAt: string | null;
  privacyVersion: number | null;
};

export type AccountStatus = "owner" | "disabled" | "comped" | "subscribed" | "past_due" | "trial" | "trial_expired" | "canceled";

export type AccountStatusInfo = {
  status: AccountStatus;
  label: string;
  /** True when the user can't use the app until something changes (no payment, expired trial, or frozen). */
  locked: boolean;
  /** Whole days left in an active trial, otherwise null. */
  daysLeft: number | null;
  tone: "good" | "info" | "warn" | "bad" | "muted";
};

/** Access rule from the spec: comped OR active trial OR active/trialing subscription. The owner's freeze overrides everything. */
export function accountStatus(
  account: Pick<AccountRecord, "isComped" | "disabled" | "trialEndsAt" | "subscriptionStatus"> & { isOwner?: boolean },
  now = new Date(),
): AccountStatusInfo {
  // The owner's account is always free and never counts down, locks, or freezes.
  if (account.isOwner) return { status: "owner", label: "Owner account", locked: false, daysLeft: null, tone: "info" };
  if (account.disabled) return { status: "disabled", label: "Frozen by admin", locked: true, daysLeft: null, tone: "bad" };
  if (account.isComped) return { status: "comped", label: "Free account (comped)", locked: false, daysLeft: null, tone: "info" };
  const sub = account.subscriptionStatus;
  if (sub === "active" || sub === "trialing") return { status: "subscribed", label: "Paid subscriber", locked: false, daysLeft: null, tone: "good" };
  if (sub === "past_due" || sub === "unpaid") return { status: "past_due", label: "Behind on payment", locked: false, daysLeft: null, tone: "warn" };
  const trialEnd = account.trialEndsAt ? new Date(account.trialEndsAt) : null;
  if (trialEnd && trialEnd.getTime() > now.getTime()) {
    const daysLeft = Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / 86_400_000));
    return { status: "trial", label: `Free trial · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`, locked: false, daysLeft, tone: "info" };
  }
  if (sub === "canceled") return { status: "canceled", label: "Canceled · locked", locked: true, daysLeft: null, tone: "bad" };
  return { status: "trial_expired", label: "Trial ended · locked (no payment)", locked: true, daysLeft: null, tone: "bad" };
}

/** Short plan label for the customer-facing menu and subscription page. Null info = record not created yet (new signup). */
export function planBadge(info: AccountStatusInfo | null): { label: string; warn: boolean; detail: string } {
  if (!info) return { label: "Free trial", warn: false, detail: `You're on the ${TRIAL_DAYS}-day free trial. No credit card on file — nothing will be charged automatically.` };
  switch (info.status) {
    case "owner":
      return { label: "Owner account", warn: false, detail: "This is the owner account of this SpoolTally workspace. It's always free, with no trial or subscription." };
    case "comped":
      return { label: "Free account", warn: false, detail: "Your account is free. No payment is needed." };
    case "subscribed":
      return { label: "Subscribed", warn: false, detail: "Your subscription is active." };
    case "past_due":
      return { label: "Payment due", warn: true, detail: "Your last payment didn't go through. Update your payment details to keep your access." };
    case "trial":
      return {
        label: `Free trial · ${info.daysLeft} day${info.daysLeft === 1 ? "" : "s"} left`,
        warn: (info.daysLeft ?? 99) <= 3,
        detail: `Your free trial has ${info.daysLeft} day${info.daysLeft === 1 ? "" : "s"} left. No credit card on file — nothing will be charged automatically.`,
      };
    case "disabled":
      return { label: "Frozen", warn: true, detail: "This account has been frozen. Contact support if you think that's a mistake." };
    case "canceled":
      return { label: "Canceled", warn: true, detail: "Your subscription was canceled. Your data is saved; subscribe again to unlock it." };
    default:
      return { label: "Trial ended", warn: true, detail: "Your free trial has ended. Your data is saved; pick a plan to unlock it." };
  }
}

/** One recorded sign-in (kept 60 days). */
export type LoginEntry = { id: string; at: string | null; method: string; device: string; country: string };

export type AdminUserSummary = {
  uid: string;
  name: string;
  email: string;
  shopName: string;
  createdAt: string | null;
  /** Last sign-in recorded by Firebase Auth. */
  lastSignIn: string | null;
  lastLogin: string | null;
  trialEndsAt: string | null;
  plan: AccountPlan;
  isComped: boolean;
  disabled: boolean;
  subscriptionStatus: string;
  /** Has the `admin` custom claim (can use the admin pages and view as users). */
  isAdmin: boolean;
  /** The app owner: the only account that can grant or remove admin rights. */
  isOwner: boolean;
};

export type AdminUserDetail = AdminUserSummary & {
  account: AccountRecord;
  providers: string[];
  emailVerified: boolean;
  counts: { rolls: number; projects: number; printers: number; maintenanceRecords: number; supportMessages: number };
};

export type AdminUserPatch = {
  isComped?: boolean;
  compNote?: string;
  disabled?: boolean;
  /** Pushes the trial end out by this many days (from today if the trial already ended). */
  extendTrialDays?: number;
  adminNotes?: string;
  /** Grant or remove admin rights. Owner only. */
  isAdmin?: boolean;
  /** Exact trial end as an ISO timestamp. Can shorten a trial as well as lengthen it. */
  setTrialEndsAt?: string;
};

export type AdminAction = "password_reset" | "send_verification" | "mark_verified" | "view_as";

/** "admin" = an admin action; "system" = something a customer or the app did. Entries from before this field are admin. */
export type HistoryKind = "admin" | "system";

export type AuditEntry = {
  id: string;
  kind: HistoryKind;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetUid: string | null;
  details: Record<string, unknown>;
  at: string | null;
};

export type SupportStatus = "open" | "resolved";

export type SupportReply = { message: string; at: string; byEmail: string };

export type SupportMessage = {
  id: string;
  ownerId: string;
  name: string;
  email: string;
  message: string;
  status: SupportStatus;
  createdAt: string | null;
  replies: SupportReply[];
};

/** Plain-English labels for the activity log. */
export const AUDIT_LABELS: Record<string, string> = {
  comp_on: "Made account free (comped)",
  comp_off: "Removed free account",
  comp_note: "Edited comp note",
  notes: "Edited private notes",
  freeze: "Froze account",
  unfreeze: "Unfroze account",
  extend_trial: "Extended trial",
  set_trial: "Set trial end date",
  grant_admin: "Granted admin",
  remove_admin: "Removed admin",
  delete_account: "Deleted account",
  password_reset: "Sent password reset email",
  send_verification: "Sent verification email",
  mark_verified: "Marked email as verified",
  view_as: "Viewed as user",
  admin_message: "Emailed a message to users",
  support_reply: "Replied to support message",
  support_resolved: "Resolved support message",
  support_reopened: "Reopened support message",
  account_created: "Account created",
  sign_in: "Signed in",
  support_message: "Sent a support message",
  export_history: "Exported the history log",
  purge_history: "Purged history",
  privacy_acknowledged: "Acknowledged the privacy summary",
};
