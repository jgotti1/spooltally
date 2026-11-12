"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { StatusBadge, formatAdminDate, formatAdminRelative } from "@/components/admin/StatusBadge";
import { accountStatus, type AdminAction, type AdminUserDetail, type AdminUserPatch, type AuditEntry, type LoginEntry, type SupportMessage } from "@/lib/account-status";
import { deleteAdminUser, fetchAdminUser, fetchAuditLog, fetchLogins, fetchSupportMessages, runAdminAction, updateAdminUser } from "@/lib/admin-api";
import { AdminNav } from "@/components/admin/AdminNav";
import { AuditList } from "@/components/admin/AuditList";
import { SupportSection } from "@/components/admin/SupportSection";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-white/5">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="st-card p-5">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function LoadingScreen() {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center st-page">
      <p className="st-loading">Loading…</p>
    </main>
  );
}

function AdminUserPageInner() {
  const { uid } = useParams<{ uid: string }>();
  const { user, loading, isAdmin, isOwner, getIdToken, startViewAs } = useAuth();
  const router = useRouter();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [compNote, setCompNote] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [trialDate, setTrialDate] = useState("");
  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [logins, setLogins] = useState<LoginEntry[] | null>(null);
  const [support, setSupport] = useState<SupportMessage[] | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.replace(user ? "/dashboard" : "/");
  }, [loading, user, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    fetchAdminUser(getIdToken, uid)
      .then((next) => {
        if (active) setDetail(next);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    fetchSupportMessages(getIdToken, uid)
      .then((next) => active && setSupport(next))
      .catch(() => active && setSupport([]));
    fetchAuditLog(getIdToken, uid)
      .then((next) => active && setHistory(next))
      .catch(() => active && setHistory([]));
    fetchLogins(getIdToken, uid)
      .then((next) => active && setLogins(next))
      .catch(() => active && setLogins([]));
    return () => {
      active = false;
    };
  }, [isAdmin, getIdToken, uid]);

  async function apply(patch: AdminUserPatch, message: string) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const next = await updateAdminUser(getIdToken, uid, patch);
      setDetail(next);
      setCompNote(null);
      setAdminNotes(null);
      setNotice(message);
      void refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshHistory() {
    try {
      setHistory(await fetchAuditLog(getIdToken, uid));
    } catch {}
  }

  async function act(action: AdminAction, message: string, reload = false) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await runAdminAction(getIdToken, uid, action);
      if (reload) setDetail(await fetchAdminUser(getIdToken, uid));
      setNotice(message);
      void refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser() {
    setDeleting(true);
    setError("");
    try {
      await deleteAdminUser(getIdToken, uid, deleteConfirm);
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that account.");
      setDeleting(false);
    }
  }

  if (loading || !user || !isAdmin) {
    return (
      <main className="flex min-h-svh flex-1 items-center justify-center st-page">
        <p className="st-loading">Loading…</p>
      </main>
    );
  }

  const info = detail ? accountStatus({ ...detail.account, isOwner: detail.isOwner }) : null;
  const isSelf = detail?.uid === user.uid;
  const buttonClass =
    "h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200";

  return (
    <main className="flex min-h-svh flex-1 flex-col st-page">
      <Header />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-8">
        <AdminNav />
        <Link href="/admin" className="mt-5 inline-block text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
          ← All users
        </Link>

        {!detail && !error && <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">Loading user…</p>}
        {error && (
          <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>
        )}
        {notice && (
          <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p>
        )}

        {detail && info && (
          <>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="truncate st-title">{detail.name || detail.email || "Unnamed user"}</h1>
                <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                  {detail.email}
                  {detail.shopName ? ` · ${detail.shopName}` : ""}
                </p>
                <div className="mt-3">
                  <StatusBadge info={info} />
                </div>
              </div>
              {!isSelf && (
                <button
                  type="button"
                  onClick={() => {
                    // Logged for the activity history; never blocks opening the view.
                    void runAdminAction(getIdToken, detail.uid, "view_as").catch(() => {});
                    startViewAs({ uid: detail.uid, name: detail.name, email: detail.email });
                    router.push("/dashboard");
                  }}
                  className="h-11 shrink-0 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  View as this user
                </button>
              )}
            </div>
            {!isSelf && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Opens the app showing their data, read-only. Nothing you do there can change their account.
              </p>
            )}

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Card title="Access & billing">
                <dl>
                  <Row label="Status">{info.label}</Row>
                  <Row label="Locked out">{info.locked ? "Yes" : "No"}</Row>
                  <Row label="Plan">{detail.isOwner ? "owner" : detail.account.plan}</Row>
                  <Row label="Trial ends">{detail.isOwner ? "n/a (owner)" : detail.account.isComped ? "n/a (comped)" : formatAdminDate(detail.account.trialEndsAt)}</Row>
                  <Row label="Payment status">
                    {detail.account.subscriptionStatus ? detail.account.subscriptionStatus.replace("_", " ") : "No subscription yet"}
                  </Row>
                </dl>
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  Payment status fills in automatically once Stripe billing is connected.
                </p>
              </Card>

              <Card title="Account">
                <dl>
                  <Row label="Signed up">{formatAdminDate(detail.createdAt)}</Row>
                  <Row label="Last sign-in">{formatAdminRelative(detail.lastSignIn)}</Row>
                  <Row label="Last active in app">{formatAdminRelative(detail.lastLogin)}</Row>
                  <Row label="Sign-in method">
                    {detail.providers.map((p) => (p === "google.com" ? "Google" : p === "password" ? "Email & password" : p)).join(", ") || "—"}
                  </Row>
                  <Row label="Email verified">{detail.emailVerified ? "Yes" : "No"}</Row>
                  <Row label="Privacy acknowledged">
                    {detail.account.privacyAcknowledgedAt
                      ? `${formatAdminDate(detail.account.privacyAcknowledgedAt)} (v${detail.account.privacyVersion ?? 1})`
                      : "Not yet"}
                  </Row>
                  <Row label="User ID">
                    <span className="font-mono text-xs break-all">{detail.uid}</span>
                  </Row>
                </dl>
              </Card>

              <Card title="Activity">
                <dl>
                  <Row label="Filament rolls">{detail.counts.rolls}</Row>
                  <Row label="Projects">{detail.counts.projects}</Row>
                  <Row label="Printers">{detail.counts.printers}</Row>
                  <Row label="Maintenance records">{detail.counts.maintenanceRecords}</Row>
                  <Row label="Support messages">{detail.counts.supportMessages}</Row>
                </dl>
              </Card>

              <Card title="Actions">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={detail.account.isComped}
                    disabled={saving}
                    onChange={(e) =>
                      void apply(
                        { isComped: e.target.checked },
                        e.target.checked ? "Marked as a free (comped) account." : "Free account removed.",
                      )
                    }
                    className="mt-0.5 h-5 w-5 rounded border-slate-300"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Free account (comped)</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">Full access with no trial or payment needed.</span>
                  </span>
                </label>
                {detail.account.isComped && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="compNote">
                      Why are they free?
                    </label>
                    <div className="mt-1 flex gap-2">
                      <input
                        id="compNote"
                        value={compNote ?? detail.account.compNote}
                        onChange={(e) => setCompNote(e.target.value)}
                        placeholder="e.g. beta tester, friend"
                        className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={saving || compNote === null}
                        onClick={() => void apply({ compNote: compNote ?? "" }, "Note saved.")}
                        className={buttonClass}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/5">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Extend free trial</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[7, 14, 30].map((days) => (
                      <button
                        key={days}
                        type="button"
                        disabled={saving}
                        onClick={() => void apply({ extendTrialDays: days }, `Trial extended by ${days} days.`)}
                        className={buttonClass}
                      >
                        +{days} days
                      </button>
                    ))}
                  </div>
                  <label htmlFor="trialDate" className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Or set an exact end date (can shorten the trial too)
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id="trialDate"
                      type="date"
                      value={trialDate}
                      onChange={(e) => setTrialDate(e.target.value)}
                      className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={saving || !trialDate}
                      onClick={() => {
                        const [y, m, d] = trialDate.split("-").map(Number);
                        // End of the chosen day in the admin's local time, so the trial runs through that whole day.
                        const end = new Date(y, m - 1, d, 23, 59, 59);
                        void apply({ setTrialEndsAt: end.toISOString() }, `Trial now ends ${end.toLocaleDateString()}.`).then(() => setTrialDate(""));
                      }}
                      className={buttonClass}
                    >
                      Set
                    </button>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/5">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Account emails</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Sent by Firebase to {detail.email || "their address"}.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.providers.includes("password") ? (
                      <button
                        type="button"
                        disabled={saving || !detail.email}
                        onClick={() => void act("password_reset", "Password reset email sent.")}
                        className={buttonClass}
                      >
                        Send password reset
                      </button>
                    ) : (
                      <span className="self-center text-xs text-slate-500 dark:text-slate-400">Signs in with Google, so there&rsquo;s no password to reset.</span>
                    )}
                    {!detail.emailVerified && detail.email && (
                      <>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void act("send_verification", "Verification email sent.")}
                          className={buttonClass}
                        >
                          Send verification email
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            if (window.confirm(`Mark ${detail.email} as verified without them clicking a link? Only do this if you know the address is theirs.`))
                              void act("mark_verified", "Email marked as verified.", true);
                          }}
                          className={buttonClass}
                        >
                          Mark verified
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/5">
                  {detail.isOwner ? (
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Owner · full admin access</p>
                  ) : (
                    <label className={`flex items-start gap-3 ${isOwner && !isSelf ? "cursor-pointer" : "opacity-70"}`}>
                      <input
                        type="checkbox"
                        checked={detail.isAdmin}
                        disabled={saving || !isOwner || isSelf}
                        onChange={(e) => {
                          const granting = e.target.checked;
                          if (granting && !window.confirm(`Give ${detail.name || detail.email || "Unnamed user"} admin rights? They'll see every user's account details and can view as any user.`)) return;
                          void apply({ isAdmin: granting }, granting ? "Admin access granted. They need to sign out and back in." : "Admin access removed.");
                        }}
                        className="mt-0.5 h-5 w-5 rounded border-slate-300"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Admin access</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {isOwner
                            ? "Can see all users, comp and freeze accounts, and view as any user. Only you can change this."
                            : "Only the owner can change admin access."}
                        </span>
                      </span>
                    </label>
                  )}
                </div>

                {!isSelf && (
                  <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/5">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {detail.account.disabled ? "Account is frozen" : "Freeze account"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Blocks sign-in and signs them out. Their data is kept and everything comes back when you unfreeze.
                    </p>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        const freezing = !detail.account.disabled;
                        if (freezing && !window.confirm(`Freeze ${detail.name || detail.email || "Unnamed user"}? They'll be signed out and blocked from logging in.`)) return;
                        void apply({ disabled: freezing }, freezing ? "Account frozen." : "Account unfrozen.");
                      }}
                      className={`mt-3 ${buttonClass}`}
                    >
                      {detail.account.disabled ? "Unfreeze account" : "Freeze account"}
                    </button>
                  </div>
                )}
              </Card>
            </div>

            {!isSelf && !detail.isOwner && (isOwner || !detail.isAdmin) && (
              <section className="mt-4 rounded-2xl border-2 border-rose-300 bg-rose-50/60 p-5 dark:border-rose-500/40 dark:bg-rose-500/5">
                <h2 className="text-sm font-bold text-rose-800 dark:text-rose-300">Danger zone · Delete this account permanently</h2>
                <p className="mt-2 text-sm text-rose-900 dark:text-rose-200">
                  This erases <strong>{detail.name || detail.email}</strong> completely: their login, {detail.counts.rolls} rolls, {detail.counts.projects} projects,{" "}
                  {detail.counts.printers} printers, {detail.counts.maintenanceRecords} maintenance records, support messages, settings, and every uploaded
                  file. <strong>This cannot be undone.</strong> If you only want to stop them using the app, freeze the account instead.
                </p>
                <label htmlFor="deleteConfirm" className="mt-4 block text-xs font-semibold text-rose-900 dark:text-rose-200">
                  Type <span className="font-mono">{detail.email || detail.uid}</span> to confirm
                </label>
                <input
                  id="deleteConfirm"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1 h-10 w-full rounded-xl border border-rose-300 bg-white px-3 text-sm dark:border-rose-500/40 dark:bg-white/5 dark:text-white"
                />
                <button
                  type="button"
                  disabled={deleting || deleteConfirm.trim().toLowerCase() !== (detail.email || detail.uid).toLowerCase()}
                  onClick={() => {
                    if (window.confirm(`Last chance: permanently delete ${detail.name || detail.email} and all of their data?`)) void deleteUser();
                  }}
                  className="mt-3 h-10 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deleting ? "Deleting…" : "Delete account and all data"}
                </button>
              </section>
            )}

            <div className="mt-4">
              <SupportSection
                messages={support}
                getIdToken={getIdToken}
                onChange={(next) => {
                  setSupport((all) => (all ?? []).map((x) => (x.id === next.id ? next : x)));
                  void refreshHistory();
                }}
              />
            </div>

            <div className="mt-4">
              <details className="group st-card mb-4 p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <span>
                    Sign-in history <span className="font-normal text-slate-500 dark:text-slate-400">· {logins ? (logins.length ? `${logins.length} in the last 60 days` : "none logged yet") : "Loading…"}</span>
                  </span>
                  <span aria-hidden="true" className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="mt-3">
                  {!logins ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
                  ) : logins.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Nothing logged yet. Sign-ins are recorded as they happen and kept for 60 days, so this fills in the next time they sign in.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 text-sm dark:divide-white/10">
                      {logins.map((login) => (
                        <li key={login.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{formatAdminDate(login.at)}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {[login.method, login.device, login.country].filter(Boolean).join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
              <details className="group st-card p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <span>
                    Account history <span className="font-normal text-slate-500 dark:text-slate-400">· {history ? `${history.length} entries` : "Loading…"}</span>
                  </span>
                  <span aria-hidden="true" className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="mt-3">
                  {history ? <AuditList entries={history} showKind /> : <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
                </div>
              </details>
            </div>

            <div className="mt-4">
              <Card title="Private notes">
                <textarea
                  value={adminNotes ?? detail.account.adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  placeholder="Only you can see these. Support history, promises made, anything worth remembering."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
                <button
                  type="button"
                  disabled={saving || adminNotes === null}
                  onClick={() => void apply({ adminNotes: adminNotes ?? "" }, "Notes saved.")}
                  className={`mt-2 ${buttonClass}`}
                >
                  Save notes
                </button>
              </Card>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function AdminUserPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AdminUserPageInner />
    </Suspense>
  );
}
