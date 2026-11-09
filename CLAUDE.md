![alt text](image.png)# SpoolTally

Web app for 3D print sellers: price estimation, filament inventory, and project tracking. Full product spec: [spec.md](spec.md).

## Stack

- **Frontend:** Next.js (TypeScript), deployed on Vercel.
- **Auth:** Firebase Auth — email/password + Google sign-in.
- **Database:** Firestore. Collections: `users`, `rolls`, `projects`, `settings`, `channels`, `brands`, `supportMessages`.
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
2. Project pricing (slicer inputs, roll selection, costs, and suggested sale price)
3. Channel fee settings and pricing math
4. Login and trial
5. Contact support form
6. Stripe billing and admin page/reports

## Branding

- Logo: a spool-of-filament icon whose unwinding strand resolves into a checkmark (tracking + pricing confidence). Canonical source: [src/components/Logo.tsx](src/components/Logo.tsx) — `Logo` (icon + wordmark) and `LogoMark` (icon only), both driven by `currentColor`/Tailwind text-color classes so they adapt to light or dark backgrounds. Reuse these components on every new page instead of redrawing the mark.
- `Header` ([src/components/Header.tsx](src/components/Header.tsx)) is the shared top nav for authenticated app pages (Inventory/Projects/etc.) and already includes the logo — drop it into new page layouts rather than building a one-off header.
- Favicon: [src/app/icon.svg](src/app/icon.svg) (Next.js App Router auto-detects this). Apple touch icon: [src/app/apple-icon.png](src/app/apple-icon.png) (also auto-detected).
- Raster export for contexts that can't render React/SVG (emails, docs): [public/logo-mark.png](public/logo-mark.png) — dark mark on transparent background, for use on light surfaces.

## Conventions

- Keep filament-level math in grams internally; fractions (Full/3/4/1/2/1/4/Empty) are a UI layer over the underlying gram value.
- Projects own their pricing inputs and calculated pricing. There is no separate Estimate entity, collection, or route.
- Every project color must be linked to an inventory roll before the project wizard can continue or the project can be saved. Users may add a new roll inline when no existing roll fits.
- A slicer filament cost is the total for the whole batch. When present, it replaces the roll-price filament calculation, is divided by batch quantity for per-unit cost, and must be labeled clearly as an override.
- Project previews in both grid and list views show total and per-unit cost, suggested per-unit sale price, filament grams, color count, nozzle, print time, and batch quantity without becoming a second edit form.
- Model uploads may generate a preview image for thumbnails. Treat that image as a supporting asset: do not count or display it as a second user upload, and remove it with its source model.
- Supported sales channels are Etsy, eBay, Amazon Handmade, own site, Facebook Marketplace, and in person. Do not expose the legacy Custom channel.
- Suggested prices use a floor of 2.5× the complete per-unit production cost, then add fixed channel fees and gross up for percentage fees: `price = (max(2.5 × cost, configured markup price) + fixed fees) / (1 - fee %)`. The configured markup may raise, but never lower, that floor.
- Treat STL-derived weights as estimates ("Estimated from model"); sliced-file-derived weights as exact ("Exact from slicer"). Surface this distinction in the UI, don't blur it.
- No screenshot-reading (Claude API) or Etsy integration in v1 — those are explicitly deferred (see spec's "Later" section).
