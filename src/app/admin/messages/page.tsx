"use client";

import { Select } from "@/components/Select";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/admin/AdminNav";
import type { AdminUserSummary } from "@/lib/account-status";
import { fetchAdminUsers, sendAdminMessage } from "@/lib/admin-api";

export default function AdminMessagePage() {
  const { user, loading, isAdmin, getIdToken } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.replace(user ? "/dashboard" : "/");
  }, [loading, user, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    fetchAdminUsers(getIdToken)
      .then((next) => active && setUsers(next))
      .catch((err: Error) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [isAdmin, getIdToken]);

  const reachable = useMemo(
    () => (users ?? []).filter((u) => u.email && !u.disabled).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)),
    [users],
  );

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!to) return setError("Choose who to send this to.");
    if (to === "all" && !window.confirm(`Email all ${reachable.length} users? Each one gets their own separate email.`)) return;
    setSending(true);
    try {
      const result = await sendAdminMessage(getIdToken, { to, subject, message });
      setNotice(
        to === "all"
          ? `Sent to ${result.sent} user${result.sent === 1 ? "" : "s"}${result.failed ? ` (${result.failed} failed)` : ""}.`
          : "Message sent.",
      );
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the message.");
    } finally {
      setSending(false);
    }
  }

  if (loading || !user || !isAdmin) {
    return (
      <main className="flex min-h-svh flex-1 items-center justify-center st-page">
        <p className="st-loading">Loading…</p>
      </main>
    );
  }

  const field =
    "w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <main className="flex min-h-svh flex-1 flex-col st-page">
      <Header />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-8">
        <AdminNav />
        <h1 className="mt-6 st-title">Message users</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sent as email. When you choose all users, each person gets their own separate email, so nobody sees who else received it.
        </p>

        <form onSubmit={handleSend} className="st-card mt-6 space-y-4 p-6">
          <div>
            <label htmlFor="msgTo" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Send to
            </label>
            <Select id="msgTo" required value={to} onChange={(e) => setTo(e.target.value)} className={`${field} h-12`}>
              <option value="">Choose…</option>
              <option value="all">All users ({reachable.length})</option>
              <optgroup label="Single user">
                {reachable.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.name ? `${u.name} — ${u.email}` : u.email}
                  </option>
                ))}
              </optgroup>
            </Select>
          </div>
          <div>
            <label htmlFor="msgSubject" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Subject
            </label>
            <input id="msgSubject" required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} className={`${field} h-12`} />
          </div>
          <div>
            <label htmlFor="msgBody" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Message
            </label>
            <textarea id="msgBody" required rows={8} maxLength={10000} value={message} onChange={(e) => setMessage(e.target.value)} className={`${field} py-3`} />
          </div>
          {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
          {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p>}
          <button type="submit" disabled={sending || !users} className="st-btn-primary h-12 px-6 text-sm font-semibold disabled:opacity-50">
            {sending ? "Sending…" : "Send message"}
          </button>
        </form>
      </div>
    </main>
  );
}
