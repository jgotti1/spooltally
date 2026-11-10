"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { StatusBadge, formatAdminDate, formatAdminRelative } from "@/components/admin/StatusBadge";
import { accountStatus, type AdminUserDetail, type AdminUserPatch } from "@/lib/account-status";
import { fetchAdminUser, updateAdminUser } from "@/lib/admin-api";

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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function LoadingScreen() {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center bg-[#f5f8fc] dark:bg-[#05080e]">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</p>
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user || !isAdmin) {
    return (
      <main className="flex min-h-svh flex-1 items-center justify-center bg-[#f5f8fc] dark:bg-[#05080e]">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  const info = detail ? accountStatus(detail.account) : null;
  const isSelf = detail?.uid === user.uid;
  const buttonClass =
    "h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200";

  return (
    <main className="flex min-h-svh flex-1 flex-col bg-[#f5f8fc] dark:bg-[#05080e]">
      <Header />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-8">
        <Link href="/admin" className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
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
                <h1 className="truncate text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{detail.name || detail.email}</h1>
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
                  <Row label="Plan">{detail.account.plan}</Row>
                  <Row label="Trial ends">{detail.account.isComped ? "n/a (comped)" : formatAdminDate(detail.account.trialEndsAt)}</Row>
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
                          if (granting && !window.confirm(`Give ${detail.name || detail.email} admin rights? They'll see every user's account details and can view as any user.`)) return;
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
                        if (freezing && !window.confirm(`Freeze ${detail.name || detail.email}? They'll be signed out and blocked from logging in.`)) return;
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
