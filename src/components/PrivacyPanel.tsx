import type { ReactNode } from "react";
import Link from "next/link";

/**
 * The Privacy tab on /settings: a plain-language summary of how SpoolTally handles a customer's information.
 * Every statement here must match what the app actually does — update it whenever data practices change
 * (new service provider, new analytics, billing going live). It is a summary, not the legal Privacy Policy.
 */

function Check() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400">
      <path d="m4.5 10.5 3.2 3.2 7.8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_var(--st-ring)]">
      <div className="flex items-center gap-3">
        <span className="st-badge st-badge-blue h-9 w-9">{icon}</span>
        <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-slate-950 dark:text-white">{title}</h3>
      </div>
      <ul className="mt-4 space-y-2.5 text-sm leading-6 text-slate-600 dark:text-slate-300">{children}</ul>
    </section>
  );
}

function Point({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Check />
      <span>{children}</span>
    </li>
  );
}

const iconProps = { viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", className: "h-5 w-5", "aria-hidden": true } as const;

export function PrivacyPanel({ hideContact = false, acknowledgedAt = null }: { hideContact?: boolean; acknowledgedAt?: string | null }) {
  return (
    <div className="mt-6 space-y-4">
      <Block
        title="Your information stays yours"
        icon={
          <svg {...iconProps}>
            <path d="M10 2.5 4 5v4.5c0 3.6 2.4 6.4 6 8 3.6-1.6 6-4.4 6-8V5l-6-2.5Z" />
            <path d="M7.5 10l2 2 3.5-4" />
          </svg>
        }
      >
        <Point>We never sell your information, and we don&rsquo;t share it with advertisers or data brokers.</Point>
        <Point>There are no ad trackers, analytics scripts, or third-party tracking cookies in SpoolTally.</Point>
        <Point>Your rolls, projects, pricing, and printers are used only to run your account.</Point>
      </Block>

      <Block
        title="Payments are handled by Stripe"
        icon={
          <svg {...iconProps}>
            <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
            <path d="M2.5 8.5h15M5.5 12.5h3" />
          </svg>
        }
      >
        <Point>
          When you subscribe, you enter your card on Stripe&rsquo;s secure checkout page. SpoolTally never sees or stores your card number or
          security code.
        </Point>
        <Point>
          All we keep is what the app needs to know your access: your plan and whether your subscription is active, past due, or ended.
        </Point>
        <Point>You can update your payment method or cancel through Stripe&rsquo;s customer portal.</Point>
      </Block>

      <Block
        title="What stays on your device"
        icon={
          <svg {...iconProps}>
            <rect x="3" y="4" width="14" height="9.5" rx="1.5" />
            <path d="M7 16.5h6M10 13.5v3" />
          </svg>
        }
      >
        <Point>Your browser keeps only your sign-in session and your light or dark mode choice, so you stay signed in and the screen looks how you left it.</Point>
        <Point>SpoolTally doesn&rsquo;t save your payment details, or your inventory and project data, in your browser&rsquo;s storage.</Point>
      </Block>

      <Block
        title="Who can see your data"
        icon={
          <svg {...iconProps}>
            <circle cx="10" cy="7" r="3" />
            <path d="M4 16.5c0-3 2.7-5 6-5s6 2 6 5" />
          </svg>
        }
      >
        <Point>
          Your account is private to you. To run the app we rely on a few service providers that process data for us: Google Firebase
          (sign-in, database, file storage), Vercel (hosting), Resend (support email), and Stripe (payments).
        </Point>
        <Point>
          To help with a support request, the SpoolTally owner can open your account in a read-only view. They can&rsquo;t change your data, and
          each time it happens it&rsquo;s logged.
        </Point>
        <Point>If your free trial ends, your data is kept safe, not deleted, and subscribing unlocks it again.</Point>
      </Block>

      {!hideContact && (
        <p className="rounded-2xl bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
          Want a copy of your data, or your account and everything in it deleted?{" "}
          <Link href="/contact" className="font-semibold text-blue-600 underline-offset-4 hover:underline dark:text-blue-400">
            Contact support
          </Link>{" "}
          and we&rsquo;ll help with that.
        </p>
      )}
      {acknowledgedAt && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          You acknowledged this on {new Date(acknowledgedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}.
        </p>
      )}
    </div>
  );
}
