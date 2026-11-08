import Image from "next/image";

type LogoProps = {
  className?: string;
};

/** Icon-only mark (spool + checklist + calculator), on a light background. */
export function LogoMark({ className }: LogoProps) {
  return (
    <Image
      src="/logo-icon.png"
      alt="SpoolTally"
      width={391}
      height={354}
      className={className}
      priority
    />
  );
}

/** Full lockup: icon + "SpoolTally" wordmark + tagline, on a light background. */
export function Logo({ className }: LogoProps) {
  return (
    <Image
      src="/logo-full.png"
      alt="SpoolTally — Track your filament. Price your prints. Keep tabs on projects."
      width={1254}
      height={364}
      className={className}
      priority
    />
  );
}
