"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { updateProfile } from "firebase/auth";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { BackLink } from "@/components/BackLink";
import { getShopSettings, saveShopSettings } from "@/lib/shop-settings";
import {
  DEFAULT_ESTIMATOR_SETTINGS,
  getEstimatorSettings,
  saveEstimatorSettings,
  type EstimatorSettings,
} from "@/lib/estimator-settings";
import { DEFAULT_CHANNELS, type ChannelFeeProfile } from "@/lib/estimator-constants";
import { PrivacyPanel } from "@/components/PrivacyPanel";
import { useAccountStatus } from "@/lib/use-account";
import {
  DEFAULT_INVENTORY_SETTINGS,
  getInventorySettings,
  saveInventorySettings,
  type InventorySettings,
} from "@/lib/inventory-settings";

type Tab = "shop" | "pricing" | "channels" | "inventory" | "privacy";

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: "shop", label: "Shop", blurb: "Your name and shop name." },
  { id: "pricing", label: "Pricing", blurb: "Hourly rates and per-order costs behind every project's cost breakdown." },
  { id: "channels", label: "Sales channels", blurb: "Fees per channel, used to gross up suggested prices." },
  { id: "inventory", label: "Inventory", blurb: "When the reorder report flags a color." },
  { id: "privacy", label: "Privacy", blurb: "How your information and payments are handled." },
];

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500";
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300";
const saveClass = "st-btn-primary h-11 px-5";

function NumberField({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = "0.01",
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-slate-400">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="number"
          min={0}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
          className={`${inputClass} ${prefix ? "pl-8" : ""} ${suffix ? "pr-12" : ""}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

function asTab(value: string | null): Tab | null {
  return TABS.some((candidate) => candidate.id === value) ? (value as Tab) : null;
}

function SettingsPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { privacyAcknowledgedAt } = useAccountStatus();
  // Deep links like /settings?tab=pricing open straight on that tab, including when you are already on /settings
  // (the profile menu's Privacy link): the URL is followed whenever its ?tab= changes.
  const searchTab = useSearchParams().get("tab");
  const [tab, setTab] = useState<Tab>(() => asTab(searchTab) ?? "shop");
  const [seenSearchTab, setSeenSearchTab] = useState(searchTab);
  if (seenSearchTab !== searchTab) {
    setSeenSearchTab(searchTab);
    const next = asTab(searchTab);
    if (next) setTab(next);
  }
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [shopName, setShopName] = useState("");
  const [pricing, setPricing] = useState<EstimatorSettings>(DEFAULT_ESTIMATOR_SETTINGS);
  const [inventory, setInventory] = useState<InventorySettings>(DEFAULT_INVENTORY_SETTINGS);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const currentName = user.displayName ?? "";
    Promise.all([getShopSettings(user.uid), getEstimatorSettings(user.uid), getInventorySettings(user.uid)])
      .then(([shop, estimator, inventorySettings]) => {
        if (!active) return;
        setDisplayName(currentName);
        setShopName(shop.shopName);
        setPricing(estimator);
        setInventory(inventorySettings);
        setLoaded(true);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Couldn't load your settings.");
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [user]);

  function updateChannel(id: ChannelFeeProfile["id"], patch: Partial<ChannelFeeProfile>) {
    setPricing((current) => ({
      ...current,
      channels: current.channels.map((channel) => (channel.id === id ? { ...channel, ...patch } : channel)),
    }));
  }

  async function run(action: () => Promise<void>, successMessage: string) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveShop(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    await run(async () => {
      const trimmed = displayName.trim();
      if (trimmed !== (user.displayName ?? "")) await updateProfile(user, { displayName: trimmed });
      await saveShopSettings(user.uid, { shopName });
    }, "Shop details saved.");
  }

  async function handleSavePricing(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    await run(() => saveEstimatorSettings(user.uid, pricing), "Pricing saved. Every project's costs now use these rates.");
  }

  async function handleSaveInventory(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    await run(() => saveInventorySettings(user.uid, inventory), "Reorder thresholds saved.");
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-svh flex-1 items-center justify-center st-page">
        <p className="st-loading">Loading…</p>
      </main>
    );
  }

  const current = TABS.find((candidate) => candidate.id === tab) ?? TABS[0];

  return (
    <main className="flex min-h-svh flex-1 flex-col st-page">
      <Header />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:px-10">
        <div className="st-pagehead">
          <BackLink />
          <div className="flex items-start gap-4">
            <span className="st-badge st-badge-slate mt-1">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
                <path d="M10 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
                <path d="M10 3v1.6M10 15.4V17M3 10h1.6M15.4 10H17M5.1 5.1l1.1 1.1M13.8 13.8l1.1 1.1M14.9 5.1l-1.1 1.1M6.2 13.8l-1.1 1.1" />
              </svg>
            </span>
            <div>
              <p className="st-eyebrow">Account</p>
              <h1 className="st-title mt-1">Settings</h1>
              <p className="st-lede mt-2">The rates, fees and thresholds behind every number in the app.</p>
            </div>
          </div>
        </div>

        <div className="st-segment mt-8 h-auto w-fit max-w-full flex-wrap" role="tablist" aria-label="Settings sections">
          {TABS.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              role="tab"
              aria-selected={tab === candidate.id}
              onClick={() => {
                setTab(candidate.id);
                setNotice("");
                setError("");
                // Keep the address in step with the tab, so a later link to ?tab=… always registers as a change.
                router.replace(`/settings?tab=${candidate.id}`, { scroll: false });
              }}
              className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${
                tab === candidate.id ? "st-segment-on" : "st-segment-off"
              }`}
            >
              {candidate.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            {notice}
          </p>
        )}

        <section className="mt-6 st-card p-6">
          <h2 className="st-section-title">{current.label}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{current.blurb}</p>

          {!loaded ? (
            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
          ) : tab === "shop" ? (
            <form onSubmit={handleSaveShop} className="mt-6 max-w-lg space-y-5">
              <div>
                <label htmlFor="displayName" className={labelClass}>
                  Your name
                </label>
                <input
                  id="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Alex Morgan"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="shopName" className={labelClass}>
                  Shop name <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="shopName"
                  value={shopName}
                  onChange={(event) => setShopName(event.target.value)}
                  placeholder="North Shore Prints"
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  Your Etsy shop or brand name. Shown on your dashboard.
                </p>
              </div>
              <div>
                <p className={labelClass}>Email</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{user.email}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  Email changes go through your sign-in provider.
                </p>
              </div>
              <button type="submit" disabled={saving} className={saveClass}>
                {saving ? "Saving…" : "Save shop details"}
              </button>
            </form>
          ) : tab === "pricing" ? (
            <form onSubmit={handleSavePricing} className="mt-6 space-y-6">
              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                  Per hour of print time
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <NumberField
                    id="machineRate"
                    label="Machine wear"
                    prefix="$"
                    suffix="/hr"
                    value={pricing.machineRatePerHour}
                    onChange={(value) => setPricing({ ...pricing, machineRatePerHour: value })}
                    hint="Depreciation, nozzles, belts, plates. $0.50–$2 is typical for a hobby-grade printer."
                  />
                  <NumberField
                    id="electricityRate"
                    label="Electricity"
                    prefix="$"
                    suffix="/hr"
                    value={pricing.electricityRatePerHour}
                    onChange={(value) => setPricing({ ...pricing, electricityRatePerHour: value })}
                    hint="A 150 W printer at $0.17/kWh is about $0.03/hr; enclosed or heated-chamber printers run higher."
                  />
                  <NumberField
                    id="laborRate"
                    label="Your labor"
                    prefix="$"
                    suffix="/hr"
                    value={pricing.laborRatePerHour}
                    onChange={(value) => setPricing({ ...pricing, laborRatePerHour: value })}
                    hint="Applied to print hours as a stand-in for setup, removal and finishing time. Leave $0 to price on materials and machine only."
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                  Per batch
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <NumberField
                    id="packagingCost"
                    label="Packaging"
                    prefix="$"
                    value={pricing.packagingCost}
                    onChange={(value) => setPricing({ ...pricing, packagingCost: value })}
                    hint="Box, tissue, labels, thank-you card."
                  />
                  <NumberField
                    id="shippingCost"
                    label="Shipping you absorb"
                    prefix="$"
                    value={pricing.shippingCost}
                    onChange={(value) => setPricing({ ...pricing, shippingCost: value })}
                    hint="Leave $0 if the buyer pays shipping separately."
                  />
                  <NumberField
                    id="failureBuffer"
                    label="Failed-print buffer"
                    suffix="%"
                    step="1"
                    value={pricing.failureBufferPercent}
                    onChange={(value) => setPricing({ ...pricing, failureBufferPercent: value })}
                    hint="Added on top of all other costs to cover reprints. 10% is a sensible default."
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                  Markup
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <NumberField
                    id="targetProfit"
                    label="Markup over cost"
                    suffix="%"
                    step="1"
                    value={pricing.targetProfitPercent}
                    onChange={(value) => setPricing({ ...pricing, targetProfitPercent: value })}
                    hint="Suggested prices never go below 2.5× cost (a 150% markup). Set this higher to raise that floor; lower values are ignored."
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={saving} className={saveClass}>
                  {saving ? "Saving…" : "Save pricing"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setPricing({ ...DEFAULT_ESTIMATOR_SETTINGS, channels: pricing.channels })}
                  className="st-btn-secondary h-11 px-4"
                >
                  Reset rates to defaults
                </button>
              </div>
            </form>
          ) : tab === "channels" ? (
            <form onSubmit={handleSavePricing} className="mt-6 space-y-4">
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                Suggested price = (price base + fixed fees) ÷ (1 − percentage fees), so the fees come out of the
                sale without eating your markup. Check each marketplace&rsquo;s current fee page; these change.
              </p>
              <div className="overflow-hidden rounded-xl shadow-[inset_0_0_0_1px_var(--st-ring)]">
                {pricing.channels.map((channel, index) => {
                  const inPerson = channel.id === "in_person";
                  return (
                    <div
                      key={channel.id}
                      className={`grid gap-3 p-4 sm:grid-cols-[minmax(140px,1fr)_repeat(4,minmax(0,1fr))] sm:items-end ${
                        index > 0 ? "border-t border-slate-100 dark:border-white/10" : ""
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{channel.label}</p>
                      <NumberField
                        id={`${channel.id}-percentFee`}
                        label={inPerson ? "Platform fee" : "Marketplace fee"}
                        suffix="%"
                        step="0.1"
                        value={channel.percentFee}
                        onChange={(value) => updateChannel(channel.id, { percentFee: value })}
                      />
                      <NumberField
                        id={`${channel.id}-fixedFee`}
                        label="Listing / per-order"
                        prefix="$"
                        value={channel.fixedFee}
                        onChange={(value) => updateChannel(channel.id, { fixedFee: value })}
                      />
                      <NumberField
                        id={`${channel.id}-processingPercent`}
                        label={inPerson ? "Card reader" : "Payment processing"}
                        suffix="%"
                        step="0.1"
                        value={channel.processingPercent}
                        onChange={(value) => updateChannel(channel.id, { processingPercent: value })}
                      />
                      <NumberField
                        id={`${channel.id}-processingFixed`}
                        label={inPerson ? "Booth / per-sale" : "Processing per order"}
                        prefix="$"
                        value={channel.processingFixed}
                        onChange={(value) => updateChannel(channel.id, { processingFixed: value })}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={saving} className={saveClass}>
                  {saving ? "Saving…" : "Save channel fees"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setPricing({ ...pricing, channels: DEFAULT_CHANNELS })}
                  className="st-btn-secondary h-11 px-4"
                >
                  Reset fees to defaults
                </button>
              </div>
            </form>
          ) : tab === "privacy" ? (
            <PrivacyPanel acknowledgedAt={privacyAcknowledgedAt} />
          ) : (
            <form onSubmit={handleSaveInventory} className="mt-6 max-w-lg space-y-5">
              <NumberField
                id="reorderBelow"
                label="Flag “Reorder now” when a color is below"
                suffix="rolls"
                step="0.1"
                value={inventory.reorderBelowRolls}
                onChange={(value) => setInventory({ ...inventory, reorderBelowRolls: value })}
                hint="Counted across every roll of the same brand, material and color."
              />
              <NumberField
                id="warnAt"
                label="Warn “Low” when a color is at or below"
                suffix="rolls"
                step="0.1"
                value={inventory.warnAtRolls}
                onChange={(value) => setInventory({ ...inventory, warnAtRolls: value })}
              />
              <button type="submit" disabled={saving} className={saveClass}>
                {saving ? "Saving…" : "Save thresholds"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  // useSearchParams must sit inside Suspense on a prerendered route.
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}
