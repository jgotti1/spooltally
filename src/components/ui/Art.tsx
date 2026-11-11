/**
 * Decorative illustrations (pure SVG, no data). Used for empty states and the dashboard hero so blank screens still
 * feel designed. Every piece is aria-hidden and inherits `currentColor` where it isn't using its own gradient.
 */

type ArtProps = { className?: string };

/** A spool seen end-on: concentric rings with a strand unwinding off to the right and resolving into a tick. */
export function SpoolArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 120" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="spool-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="spool-b" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1d6ff2" />
          <stop offset="100%" stopColor="#14b87a" />
        </linearGradient>
      </defs>
      <circle cx="58" cy="60" r="44" stroke="url(#spool-a)" strokeWidth="2.5" opacity="0.35" />
      <circle cx="58" cy="60" r="34" stroke="url(#spool-a)" strokeWidth="2.5" opacity="0.55" />
      <circle cx="58" cy="60" r="24" stroke="url(#spool-a)" strokeWidth="2.5" opacity="0.8" />
      <circle cx="58" cy="60" r="9" fill="url(#spool-a)" />
      <path
        d="M100 52c16-4 24 6 28 18s14 16 28 8"
        stroke="url(#spool-b)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M128 74l9 9 17-20" stroke="#14b87a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A print job card: a clipboard with a price tag peeking out. */
export function ClipboardArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 120" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="clip-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <rect x="44" y="22" width="72" height="86" rx="12" stroke="url(#clip-a)" strokeWidth="2.5" opacity="0.8" />
      <rect x="64" y="14" width="32" height="14" rx="6" fill="url(#clip-a)" />
      <path d="M58 52h44M58 66h30M58 80h38" stroke="url(#clip-a)" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <path
        d="M112 70l24 24-10 10-24-24V70h10z"
        fill="#fff"
        stroke="#14b87a"
        strokeWidth="2.5"
        strokeLinejoin="round"
        className="dark:fill-[#0b1420]"
      />
      <circle cx="108" cy="76" r="2.5" fill="#14b87a" />
    </svg>
  );
}

/** Printer care: a wrench crossing a gear. */
export function WrenchArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 120" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="wrench-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <circle cx="66" cy="62" r="26" stroke="url(#wrench-a)" strokeWidth="2.5" opacity="0.55" strokeDasharray="8 7" />
      <circle cx="66" cy="62" r="12" stroke="url(#wrench-a)" strokeWidth="2.5" />
      <path
        d="M118 30a14 14 0 0 0-18 15L74 71a6 6 0 0 0 8.5 8.5l26-26a14 14 0 0 0 15-18l-8 8-7-1-1-7 8-8z"
        fill="#fff"
        stroke="url(#wrench-a)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        className="dark:fill-[#0b1420]"
      />
    </svg>
  );
}

/** Large, low-contrast strand + rings for the dashboard hero. Positioned by the parent; fills its box. */
export function HeroArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 520 320" fill="none" aria-hidden="true" className={className} preserveAspectRatio="xMaxYMid slice">
      <defs>
        <linearGradient id="hero-strand" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#45a9ff" stopOpacity="0" />
          <stop offset="45%" stopColor="#45a9ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#28df98" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id="hero-ring" cx="0.5" cy="0.5" r="0.5">
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.14" />
        </radialGradient>
      </defs>
      <circle cx="430" cy="160" r="150" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="1.5" />
      <circle cx="430" cy="160" r="112" stroke="#ffffff" strokeOpacity="0.09" strokeWidth="1.5" />
      <circle cx="430" cy="160" r="74" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1.5" />
      <circle cx="430" cy="160" r="36" fill="url(#hero-ring)" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.5" />
      <path
        d="M-10 250c90 6 150-70 230-72s118 70 206 50 118-66 150-46"
        stroke="url(#hero-strand)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M548 178l10 10 18-22" stroke="#28df98" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}
