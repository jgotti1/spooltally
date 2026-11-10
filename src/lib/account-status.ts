/** Shared (client + server) account model for the owner's admin tools. Dates travel as ISO strings. */

export const TRIAL_DAYS = 14;

export type AccountPlan = "trial" | "weekly" | "quarterly" | "yearly";

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
};

export type AccountStatus = "disabled" | "comped" | "subscribed" | "past_due" | "trial" | "trial_expired" | "canceled";

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
  account: Pick<AccountRecord, "isComped" | "disabled" | "trialEndsAt" | "subscriptionStatus">,
  now = new Date(),
): AccountStatusInfo {
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
};
