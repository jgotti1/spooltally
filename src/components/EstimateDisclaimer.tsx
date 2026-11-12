/**
 * Shown wherever SpoolTally displays costs or suggested prices (projects list and the project pricing step).
 * Keep the wording the same in both places; it is the app's liability disclaimer for estimates.
 */
export function EstimateDisclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500 dark:bg-white/[0.04] dark:text-slate-400 ${className}`}>
      <span className="font-semibold text-slate-700 dark:text-slate-300">Just an estimate.</span> These numbers are our best guess based on
      what you entered. Your real costs can differ, since electricity rates, printer wear and tear, and waste all vary from shop to
      shop and printer to printer. We did our best to help you price your items accurately for your chosen platform or local market.
    </p>
  );
}
