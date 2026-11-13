/**
 * A little spool seen from the side: the flange, the wound filament in the roll's color (thicker the fuller it is),
 * and the hub. Purely decorative — the numbers beside it carry the real information.
 */
export function SpoolPreview({ color, fraction, className = "h-16 w-16" }: { color: string; fraction: number; className?: string }) {
  const hub = 9;
  const max = 25;
  const clamped = Math.max(0, Math.min(1, fraction));
  const thickness = (max - hub) * clamped;
  const radius = hub + thickness / 2;
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="32" cy="32" r="30" className="fill-slate-100 stroke-slate-300 dark:fill-white/[0.06] dark:stroke-white/20" strokeWidth="1.5" />
      {thickness > 0 && <circle cx="32" cy="32" r={radius} fill="none" stroke={color} strokeWidth={thickness} />}
      {/* A faint edge so dark filament still reads on a dark card (and white on a light one). */}
      {thickness > 0 && <circle cx="32" cy="32" r={hub + thickness} fill="none" className="stroke-slate-900/15 dark:stroke-white/35" strokeWidth="1" />}
      {/* winding lines */}
      {thickness > 5 &&
        [0.33, 0.66].map((t) => (
          <circle key={t} cx="32" cy="32" r={hub + thickness * t} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.7" />
        ))}
      <circle cx="32" cy="32" r={max} fill="none" className="stroke-slate-300 dark:stroke-white/20" strokeWidth="1" strokeDasharray="2 3" />
      <circle cx="32" cy="32" r={hub} className="fill-white stroke-slate-300 dark:fill-[#0e1623] dark:stroke-white/25" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="2.5" className="fill-slate-400 dark:fill-slate-500" />
    </svg>
  );
}
