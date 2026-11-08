# SpoolTally

Web app for 3D print sellers: price estimation, filament inventory, and project tracking. Full product spec: [spec.md](spec.md).

## Stack

- **Frontend:** Next.js (TypeScript), deployed on Vercel.
- **Auth:** Firebase Auth — email/password + Google sign-in.
- **Database:** Firestore. Collections: `users`, `rolls`, `projects`, `estimates`, `settings`, `channels`, `brands`, `supportMessages`.
- **Backend logic:** Firebase Cloud Functions (Stripe webhooks, admin tools, outbound email) — requires Blaze plan.
- **Billing:** Stripe Checkout + Stripe Customer Portal, synced to Firestore via Stripe's Firebase extension.
- **3D/file parsing:** Three.js `STLLoader` for mesh volume; plain-code parsing for sliced 3MF/G-code headers (no external API).
- **Email:** Firebase "Trigger Email" extension with an SMTP provider, or Resend/SendGrid — never an email password in client code.

## Auth and access rules

- Access = `isComped` OR active trial OR active/trialing Stripe subscription.
- Trial ends → data locked, not deleted.
- Admin routes gated by a Firebase custom claim (`admin`) plus matching Firestore security rules — never by hiding the route client-side.
- Owner's support inbox address (jgotti711@gmail.com) stays server-side only, never rendered to users.

## Build order (follow this sequence; don't jump ahead)

1. Rolls (inventory) + projects + low-filament report
2. Estimator (manual, STL, 3MF/G-code) + roll selection + save-as-project
3. Channel fee settings and pricing math
4. Login and trial
5. Contact support form
6. Stripe billing and admin page/reports

## Branding

- Logo: a spool-of-filament icon whose unwinding strand resolves into a checkmark (tracking + pricing confidence). Canonical source: [src/components/Logo.tsx](src/components/Logo.tsx) — `Logo` (icon + wordmark) and `LogoMark` (icon only), both driven by `currentColor`/Tailwind text-color classes so they adapt to light or dark backgrounds. Reuse these components on every new page instead of redrawing the mark.
- `Header` ([src/components/Header.tsx](src/components/Header.tsx)) is the shared top nav for authenticated app pages (Estimator/Inventory/Projects/etc.) and already includes the logo — drop it into new page layouts rather than building a one-off header.
- Favicon: [src/app/icon.svg](src/app/icon.svg) (Next.js App Router auto-detects this). Apple touch icon: [src/app/apple-icon.png](src/app/apple-icon.png) (also auto-detected).
- Raster export for contexts that can't render React/SVG (emails, docs): [public/logo-mark.png](public/logo-mark.png) — dark mark on transparent background, for use on light surfaces.

## Conventions

- Keep filament-level math in grams internally; fractions (Full/3/4/1/2/1/4/Empty) are a UI layer over the underlying gram value.
- Pricing formula: `price = (cost + target profit + fixed fees) / (1 - fee %)`.
- Treat STL-derived weights as estimates ("Estimated from model"); sliced-file-derived weights as exact ("Exact from slicer"). Surface this distinction in the UI, don't blur it.
- No screenshot-reading (Claude API) or Etsy integration in v1 — those are explicitly deferred (see spec's "Later" section).
