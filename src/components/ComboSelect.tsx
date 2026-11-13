"use client";

import { useState } from "react";
import { CUSTOM_OPTION } from "@/lib/inventory-constants";

type ComboSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  customPlaceholder?: string;
};

/** A dropdown of preset options with a free-text "Other (custom)" fallback. */
export function ComboSelect({ label, value, onChange, options, customPlaceholder }: ComboSelectProps) {
  const [isCustom, setIsCustom] = useState(() => value !== "" && !options.includes(value));

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
      <select
        value={isCustom ? CUSTOM_OPTION : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM_OPTION) {
            setIsCustom(true);
            onChange("");
          } else {
            setIsCustom(false);
            onChange(e.target.value);
          }
        }}
        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        <option value={CUSTOM_OPTION}>{CUSTOM_OPTION}</option>
      </select>
      {isCustom && (
        <input
          autoFocus
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={customPlaceholder ?? "Enter a custom value"}
          className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
        />
      )}
    </div>
  );
}
