"use client";

import { useState, type FormEvent } from "react";
import { updateProfile, type User } from "firebase/auth";
import { saveShopSettings } from "@/lib/shop-settings";

type Props = {
  user: User;
  /** Ask for the shop name only when it's missing. */
  needsShopName: boolean;
  /** Ask for a name only when the account has none (e.g. a Google profile without one). */
  needsName: boolean;
  onDone: (result: { name?: string; shopName?: string }) => void;
};

/**
 * First-login prompt for anything the account is missing (typically after Google sign-in, which skips the signup form).
 * Everything is optional, and both buttons mark the prompt as handled so it never nags again.
 */
export function ProfilePrompt({ user, needsShopName, needsName, onDone }: Props) {
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function finish(save: boolean) {
    setBusy(true);
    setError("");
    try {
      const result: { name?: string; shopName?: string } = {};
      if (save && needsName && name.trim()) {
        await updateProfile(user, { displayName: name.trim() });
        result.name = name.trim();
      }
      if (save && needsShopName && shopName.trim()) result.shopName = shopName.trim();
      await saveShopSettings(user.uid, { ...(result.shopName ? { shopName: result.shopName } : {}), profilePromptDone: true });
      onDone(result);
    } catch {
      setError("Couldn't save that. Please try again, or skip for now.");
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void finish(true);
  }

  const inputClass =
    "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500";

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/70 p-5 dark:border-blue-400/20 dark:bg-blue-500/10"
    >
      <h2 className="text-base font-semibold text-slate-950 dark:text-white">Finish setting up your workshop</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        A couple of details to personalize SpoolTally. Both are optional, and you can add or change them anytime in Settings.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {needsName && (
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Your name
            <input
              type="text"
              autoComplete="name"
              placeholder="Jane Maker"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} mt-1.5 font-normal`}
            />
          </label>
        )}
        {needsShopName && (
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Shop name
            <input
              type="text"
              autoComplete="organization"
              placeholder="North Shore Prints"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className={`${inputClass} mt-1.5 font-normal`}
            />
          </label>
        )}
      </div>
      {error && <p className="mt-3 text-xs font-medium text-rose-700 dark:text-rose-300">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void finish(false)}
          className="h-10 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:underline disabled:opacity-60 dark:text-slate-300"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}
