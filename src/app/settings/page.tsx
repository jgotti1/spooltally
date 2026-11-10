"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import {
  DEFAULT_INVENTORY_SETTINGS,
  getInventorySettings,
  saveInventorySettings,
  type InventorySettings,
} from "@/lib/inventory-settings";

type Tab = "shop" | "pricing" | "channels" | "inventory";

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: "shop", label: "Shop", blurb: "Your name and shop name." },
  { id: "pricing", label: "Pricing", blurb: "Hourly rates and per-order costs behind every project's cost breakdown." },
  { id: "channels", label: "Sales channels", blurb: "Fees per channel, used to gross up suggested prices." },
  { id: "inventory", label: "Inventory", blurb: "When the reorder report flags a color." },
];

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500";
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300";
const saveClass =
  "flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600";

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

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  // Deep links like /settings?tab=pricing open straight on that tab.
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "shop";
    const requested = new URLSearchParams(window.location.search).get("tab");
    return requested && TABS.some((candidate) => candidate.id === requested) ? (requested as Tab) : "shop";
  });
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
      <main className="flex min-h-svh flex-1 items-center justify-center bg-[#f5f8fc] dark:bg-[#05080e]">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  const current = TABS.find((candidate) => candidate.id === tab) ?? TABS[0];

  return (
    <main className="flex min-h-svh flex-1 flex-col bg-[#f5f8fc] dark:bg-[#05080e]">
      <Header />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:px-10">
        <BackLink />
        <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-blue-400">Account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl dark:text-white">
          Settings
        </h1>

        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Settings sections">
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
              }}
              className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors ${
                tab === candidate.id
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]"
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

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{current.label}</h2>
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
                  className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
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
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
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
                  className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  Reset fees to defaults
                </button>
              </div>
            </form>
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
