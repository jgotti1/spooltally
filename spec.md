
# SpoolTally: v1 Spec

Name: SpoolTally (final).
Domain: spooltally.com (available at $12.03/yr on Vercel as of 2026-11-07; owner buying). Add it to Firebase Auth authorized domains and Stripe checkout URLs. Owner's other domain, margotticode.com, stays at Bluehost.
Tagline: "Track your filament. Price your prints."

Web app for 3D print sellers with three sections: (1) Estimator, (2) Filament inventory, (3) Projects.

## Goal
Side income of ~$500/month (roughly 55-70 paying subscribers). Validate with a free beta (~10 sellers) before building billing.

## Responsive design
- Must work well on phone, tablet (iPad), and desktop — this is a hard requirement, not a nice-to-have.
- Filament inventory (Section 2) especially: sellers update roll levels standing at the printer/workbench, usually on a phone. Level-tap controls (Full/3/4/1/2/1/4/Empty), quick add, and search/filter must be comfortable one-handed on a small screen — large tap targets, no hover-only interactions, no horizontal scrolling for core actions.
- Estimator and Projects should also be fully usable on phone/tablet, but inventory is the priority case to design and test against first.
- Build mobile-first; verify each page at phone, tablet, and desktop widths before calling it done.

## Section 1: Estimator
- Upload box: STL, sliced 3MF/G-code, or manual entry (grams + hours).
- Sliced 3MF/G-code: read exact grams per color and print time from file headers (plain code, no API).
- STL: volume from mesh (Three.js STLLoader), weight = volume x infill/wall factor x density (PLA ~1.24 g/cm3, PETG ~1.27). Time from a calibration factor.
- Accuracy badge: "Exact from slicer" vs "Estimated from model".
- Choose which rolls the job uses: from current inventory OR from planned/future rolls (price a job before buying filament).
- Multi-color jobs: include a purge/waste percentage (e.g., AMS-style color changes).
- Quantity per batch (e.g., 6 units per plate) with price per unit.
- Output: estimated cost + suggested retail price, based on sales channel (online or in person).
- "Save as project": name the estimate and turn it into a project (feeds Section 3 and reports).
- NOT in v1: screenshot reading via Claude API (later, server-side, capped per user).

### Pricing
- Sales channel dropdown: Etsy, eBay, Amazon Handmade, own site, Facebook Marketplace, in person, Custom.
- Each channel = editable fee profile (percent fee, fixed fee, payment processing %, payment fixed, extras), stored in Firestore `channels`, labeled as estimates.
- In person: no platform fee; optional card reader fee and booth fee.
- Compare prices across channels side by side.
- Cost = filament + machine time x rate + electricity + ~10% failure buffer + labor + packaging + optional shipping.
- Formula: `price = (cost + target profit + fixed fees) / (1 - fee %)`
- User settings: machine hourly rate, electricity cost, labor rate, margin, selected channels.

## Section 2: Filament inventory
- Each roll entry: brand (dropdown of major brands + manual "add brand"), material, color, size (default 1 kg; 750 g, 2 kg, 5 kg), price paid.
- Brand dropdown seed list: Bambu Lab, Hatchbox, Polymaker, eSun, Sunlu, Elegoo, Overture, Prusament, Creality, Inland, Atomic, Protopasta, plus Other/custom.
- Level selection (quick tap): Full, 3/4, 1/2, 1/4, Empty. Converted to grams underneath.
- If "Full": ask how many are in stock (quantity). Partial rolls are tracked individually.
- Quick add: fast "add roll" flow (duplicate last roll, or add +1 to quantity of an existing full-roll entry).
- Same color/material rolls count together toward project needs.
- Inventory report: all inventory, or broken down by project, with suggestions on what to reorder. Combined "Reorder soon" shopping list.

## Section 3: Projects
- Created from saved estimates. Status: Active, Queued, Done.
- Shows colors needed with grams per print/batch, and which rolls were used for reference.
- "Mark printed" deducts estimated grams from rolls, shows nearest fraction, stores exact number. Re-tapping a level resets the estimate. (Optional later: "weigh it" exact field.)
- Low-filament report per project: e.g., "Project Z needs green, your green is ~1/4 (about 250 g), need 400 g, reorder." Use "may run short" wording (fractions are rough).
- "Can make X more units" per project; suggests whether to order more soon.

## Contact support
- In-app "Contact support" form: name, email (prefilled from account), subject, message.
- Submission is saved to Firestore (`supportMessages`) AND emailed to the owner's inbox: johnmargotti@gmail.com (kept server-side only, never shown to users; owner reads it through a third-party mail app).
- Send mail through an email service, not by logging into Gmail from the app: Firebase "Trigger Email" extension with an SMTP provider, or Resend/SendGrid. Never store an email password in client code.
- Spam protection: Firebase App Check/reCAPTCHA and per-user rate limit.
- Admin page shows support messages with a status (new / replied / closed).

## User profile
- Collected at signup: `name` (from Google displayName, or entered manually for email/password signup), `email` (from Firebase Auth).
- Optional: `shopName` (their Etsy/shop name — used for personalization and future Etsy integration).
- Stored on `users` doc: `name`, `email`, `shopName`, `createdAt`, `plan` (see below), `trialEndsAt`, `lastLogin`, `isComped`.
- v1: editable via a basic account settings page (name, shop name). Email changes go through Firebase Auth's own flow.

## Accounts and billing
- Firebase Auth: email/password + Google. Register via either method.
- Password reset: "Forgot password" flow (Firebase Auth `sendPasswordResetEmail`) for email/password accounts. Google-authenticated accounts have no password to reset — show a message pointing them to Google account recovery instead.
- Free trial: 14 days, no card upfront. After 14 days: must add a credit card (Stripe) to continue; data locked (not deleted) until they do.
- Reminder emails before trial ends.
- Membership types (`plan` field): `trial`, `weekly`, `quarterly`, `yearly`.
  - Stripe Checkout tiers: weekly (~$2-3/wk, for short-term/seasonal sellers), quarterly ($20 per 3 months), yearly (~$60-79, consider a locked-in early-tester price). Exact weekly price TBD before launch.
  - Monthly tier dropped in favor of weekly/quarterly/yearly — revisit if testers want a monthly middle option.
- Stripe Customer Portal for cancel/card updates. Use Stripe's Firebase extension to sync subscription status (and `plan` tier) to Firestore.
- Access check: isComped OR active trial OR active/trialing subscription (any plan tier).
- Landing copy: "Payments processed by Stripe" (do not claim own PCI certification). Show Terms, Privacy, Refund, contact.

## Admin page (owner only)
- User management: list with name, email, signup date, trial end, plan (trial / weekly / quarterly / yearly / expired / free), last login, search and filter.
- Per-user actions: extend trial, toggle "Free account" (`isComped`) on/off, freeze/disable account (blocks login and app access without deleting data).
- Subscribers: active subscribers, plan, renewal date, canceled/failed payments.
- Free (comped) users list with note on why, and one-click uncheck.
- Reports: signups over time, trial-to-paid conversion, active trials, expired trials, paid count, monthly revenue, churn, most active users, feature usage (estimates run, rolls added, projects created), exportable as CSV.
- Support inbox (from Contact support form).
- Security: Firebase custom claim `admin` + Firestore security rules. Never rely on hiding the route.

## Tech
- Next.js frontend (Vercel or Firebase Hosting), Firebase Auth + Firestore.
- Cloud Functions for Stripe, admin tools, and email (Blaze plan).
- Firestore collections: `users`, `rolls`, `projects`, `estimates`, `settings`, `channels`, `brands`, `supportMessages`.

## Build order
1. Rolls (brand dropdown, levels, quantity, quick add), projects, low-filament report
2. Estimator: manual entry, STL, 3MF/G-code; roll selection; save as project
3. Channel fee settings and pricing
4. Login and trial
5. Contact support form
6. Stripe and admin page with reports

## Later
Screenshot reader (Claude API, server-side, per-user caps), Etsy shop connection (Open API v3, OAuth, read-only scopes, commercial approval required, apply early), order alerts, optional exact weighing.

## Launch plan
- Ask for feedback in Facebook groups (check each group's rules; be upfront about post-trial price).
- Competitors exist (Spoolo, PrintMate, Craftybase, MakerQuote, 3DPCC). Differentiators: project-based low-filament report, STL/3MF upload to price, fraction-based roll levels, multi-channel fee-aware pricing, web app.
- Test a minimal version with ~10 sellers first; add login/billing/admin once testers ask to keep using it.
