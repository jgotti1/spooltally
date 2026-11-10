# SpoolTally

Web app for 3D print sellers: price estimation, filament inventory, project tracking, and printer maintenance. Full product spec: [spec.md](spec.md).

## Stack

- **Frontend:** Next.js (TypeScript), deployed on Vercel.
- **Auth:** Firebase Auth — email/password + Google sign-in.
- **Database:** Firestore. Collections: `users`, `rolls`, `projects`, `printers`, `maintenanceRecords`, `settings`, `channels`, `brands`, `supportMessages`.
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
- `Header` ([src/components/Header.tsx](src/components/Header.tsx)) is the shared top nav for authenticated app pages (Inventory/Projects/Maintenance) and already includes the logo — drop it into new page layouts rather than building a one-off header.
- Favicon: [src/app/icon.svg](src/app/icon.svg) (Next.js App Router auto-detects this). Apple touch icon: [src/app/apple-icon.png](src/app/apple-icon.png) (also auto-detected).
- Raster export for contexts that can't render React/SVG (emails, docs): [public/logo-icon.png](public/logo-icon.png) (mark only) and [public/logo-full.png](public/logo-full.png) (mark + wordmark).

## Printer maintenance

- The authenticated route is `/maintenance`, implemented by [src/app/maintenance/page.tsx](src/app/maintenance/page.tsx) and [src/components/PrinterMaintenance.tsx](src/components/PrinterMaintenance.tsx).
- Users give every printer a custom display name and select its model from the grouped common-model list in [src/lib/printer-maintenance.ts](src/lib/printer-maintenance.ts). Always retain the `Other / custom model` option so an unlisted printer can be entered manually.
- Printer documents live in the `printers` collection with `ownerId`, `name`, `model`, `nextDueDate`, `createdAt`, and `updatedAt`. The printer owns its own next-due date directly — scheduling it does not require logging any completed maintenance.
- Service entries live in the separate `maintenanceRecords` collection with `ownerId`, `printerId`, `completedDate`, `notes`, and `createdAt` — records carry no due-date field of their own.
- Logging work and scheduling the next date are two independent actions, each with its own form and validation: "Record finished maintenance" requires the printer, a completed date, and notes describing the work; "Schedule next maintenance" requires only the printer and a date, with no notes. Dates are stored as local `YYYY-MM-DD` strings to avoid timezone changes to the selected calendar day.
- A printer's `nextDueDate` field is the sole source of truth for its due status — never derived from maintenance history. It can be set or changed independently from the printer's detail panel at any time. Due today and overdue printers must appear in the reminder on both `/dashboard` and `/maintenance`.
- A printer with no `nextDueDate` set is labeled as unscheduled; it is not considered overdue until a next due date exists.
- Keep the model list, subscriptions, date formatting, and due-status calculation centralized in `src/lib/printer-maintenance.ts` rather than duplicating that logic in pages.
- Firestore rules must keep both collections owner-scoped, matching `request.auth.uid` to each document's `ownerId`.
- The printer list supports block (card grid) and list (compact row) views via the same toggle pattern as the Projects list. Both views show a summary only — name, model, status, last service date, and record count — never the full history inline.
- Double-clicking a printer (or its "View full log" button, for discoverability on touch devices) opens a detail panel with two sections: **Scheduled maintenance** (the printer's `nextDueDate`, with a "Mark complete" button and a date editor) and **Finished maintenance** (the complete chronological history). Closing it does not navigate away from `/maintenance`.
- "Mark complete" is the one place the two actions combine, and only because the user explicitly asks for it: it takes a completed date and required notes plus an optional next date, then writes the `maintenanceRecords` entry and replaces the printer's `nextDueDate` (with the new date, or `""` if left blank) in a single Firestore batch via `completeScheduledMaintenance`. Due status is still read only from `nextDueDate`.
- Keep the printer model list current with each brand's active lineup (e.g. Bambu Lab's X1/P1/P2/A1 series plus its H2D/H2S/H2C line) — revisit periodically rather than letting it go stale.

## Admin (owner tools)

- Routes: `/admin` (user list) and `/admin/users/[uid]` (details), shown in the header only when the signed-in token carries the `admin` custom claim. The real gates are server-side: every `/api/admin/*` route calls `requireAdmin` in [src/lib/admin/server.ts](src/lib/admin/server.ts), and Firestore/Storage rules allow admin *reads* only.
- Server code uses the Firebase Admin SDK with `FIREBASE_SERVICE_ACCOUNT_JSON` (server-only env var, never `NEXT_PUBLIC_`, never committed). No Cloud Functions needed for this: Next route handlers do it.
- Custom claims: `admin` (can use the admin pages) and `owner` (the only account that can grant/remove `admin`, and can't be frozen). The owner gets both automatically on first sign-in when the server env var `OWNER_EMAIL` matches their verified email (`/api/session`); `scripts/set-admin-claim.mjs` does the same by hand.
- `users/{uid}` is read-only to clients (rules: `write: false`). It is created/updated only by `/api/session` (trial = Auth signup date + 14 days, `lastLogin`) and `/api/admin/*` (comp, freeze, trial extension, notes). Never let the client write trial/plan/comp fields.
- Owner-only text (private notes, the reason an account is comped) lives in `adminPrivate/{uid}`, not on `users/{uid}`, because a user can read their own `users` doc. No Firestore rule matches `adminPrivate`, so only the Admin SDK reaches it — never add a client rule for it.
- Account status is computed in [src/lib/account-status.ts](src/lib/account-status.ts) (`accountStatus`): disabled → comped → active/trialing subscription → past_due/unpaid → trial → expired. `subscriptionStatus` stays empty until the Stripe step fills it in.
- Deleting an account (`DELETE /api/admin/users/[uid]`, red danger zone on the user page) erases all `ownerId` docs, `settings`, `users`, `adminPrivate`, `projects/{uid}/` Storage files, then the Auth login. It requires the caller to retype the account's email, can't target self or the owner, and only the owner can delete another admin. When Stripe lands, cancel the customer's subscription there too.
- Every admin action writes to the server-only `adminAudit` collection via `audit()` in [src/lib/admin/server.ts](src/lib/admin/server.ts) (no client rule, like `adminPrivate`). Add an `audit()` call and an `AUDIT_LABELS` entry for any new admin action. Shown at `/admin/activity` and per user.
- Support inbox: `/api/contact` (signed-in only) saves to `supportMessages` with `status` open/resolved and a `replies` array, then emails the owner. `/admin/support` lists them; replies are emailed to the customer through Resend and need `RESEND_FROM` (a sender on a domain verified in Resend), because Resend's shared test sender only delivers to the Resend account's own address. Replies never set a reply-to, so the owner's inbox address stays hidden.
- Password reset and verification emails from admin go through Firebase's own mailer (Identity Toolkit REST in [src/lib/admin/firebase-email.ts](src/lib/admin/firebase-email.ts)), using the templates in Firebase Console → Authentication → Templates. Signups are not sent a verification email and nothing in the app requires one; admins can send one or mark an email verified by hand.
- "View as" is read-only by construction: the auth context swaps in the customer's uid so pages work unchanged, but rules reject every write that isn't the owner's own, and a persistent banner shows who is being viewed. Freezing disables the Auth account and revokes its tokens; data is kept.

## Trial lock and read-only mode

- The access rule lives in two places that must stay in step: `accountStatus()` in [src/lib/account-status.ts](src/lib/account-status.ts) and `canWrite()` / `frozen()` in [firestore.rules](firestore.rules). A locked account (trial over, no subscription) can still read its data but can't write; a frozen account can't read or write. Admins are exempt, and an account with no `users` doc yet counts as a fresh trial.
- Client side: `useAccountStatus()` ([src/lib/use-account.ts](src/lib/use-account.ts)) listens to the user's own `users` doc; `AccessGate` ([src/components/AccessGate.tsx](src/components/AccessGate.tsx), mounted in the root layout) sends locked accounts to `/subscribe` and signs frozen ones out. Use `planBadge()` for any customer-facing plan label instead of hard-coding "Free trial".
- View-as is read-only in the UI too: `assertWritable()` ([src/lib/read-only.ts](src/lib/read-only.ts)) is the first line of every write function in `src/lib`, and `html[data-view-as]` in globals.css hides `/new` links and disables submit buttons. Add `assertWritable()` to any new write function.
- There is no Firebase CLI config in this repo: rules changes are published by pasting [firestore.rules](firestore.rules) / [storage.rules](storage.rules) into the Firebase Console.
- Users with a password change it at `/account/password` (current password required); Google-only accounts are told to use Google.

## Billing rules (build with step 6, Stripe)

- Subscribing requires a verified email. The trial and the rest of the app stay open to unverified accounts; only checkout is gated. Google sign-in accounts are already verified, so this only affects email/password signups.
- The real check is server-side: the Stripe Checkout route must reject an unverified account (`email_verified` on the ID token), not just hide the plan buttons. On `/subscribe`, show unverified users "Verify your email to subscribe" with a Send verification email button (Firebase `sendEmailVerification`) and an "I've verified, continue" button that reloads the user and refreshes the token.

## Conventions

- Keep filament-level math in grams internally; fractions (Full/3/4/1/2/1/4/Empty) are a UI layer over the underlying gram value.
- Projects own their pricing inputs and calculated pricing. There is no separate Estimate entity, collection, or route.
- Every project color must be linked to an inventory roll before the project wizard can continue or the project can be saved. Users may add a new roll inline when no existing roll fits.
- A slicer filament cost is the total for the whole batch. When present, it replaces the roll-price filament calculation, is divided by batch quantity for per-unit cost, and must be labeled clearly as an override.
- Project previews in both grid and list views show total and per-unit cost, suggested per-unit sale price, filament grams, color count, nozzle, print time, and batch quantity without becoming a second edit form.
- Model uploads may generate a preview image for thumbnails. Treat that image as a supporting asset: do not count or display it as a second user upload, and remove it with its source model.
- Supported sales channels are Etsy, eBay, Amazon Handmade, own site, Facebook Marketplace, and in person. Do not expose the legacy Custom channel.
- Suggested prices use a floor of 2.5× the complete per-unit production cost, then add fixed channel fees and gross up for percentage fees: `price = (max(2.5 × cost, configured markup price) + fixed fees) / (1 - fee %)`. The configured markup may raise, but never lower, that floor.
- Printers are stored separately from maintenance history. Each printer's own `nextDueDate` field controls its due status and dashboard reminder, set independently of logging completed maintenance.
- Treat STL-derived weights as estimates ("Estimated from model"); sliced-file-derived weights as exact ("Exact from slicer"). Surface this distinction in the UI, don't blur it.
- Pricing rates, sales-channel fees, reorder thresholds, and the shop name are all edited on `/settings` ([src/app/settings/page.tsx](src/app/settings/page.tsx), tabs via `?tab=shop|pricing|channels|inventory`), reached from the user menu. Every value lives on the owner-scoped `settings/{uid}` doc (`shopName` included, until a `users` doc exists). Don't add one-off settings editors inside feature pages — link to the matching tab instead.
- "May run short" and "Can make N more units" come from `src/lib/project-stock.ts`: a color's need is `gramsNeeded × batch quantity`, checked against the grams on hand across every roll of the same material + color (not just the linked roll). Use it for the dashboard counts and project badges rather than checking `remainingGrams === 0`.
- Rolls carry an optional free-text `notes` field (lot number, where bought, settings that worked); show it as a secondary line, never as a filter key.
- Printers can be renamed, re-modeled, and deleted (with their records, in one batch) from the detail panel; finished maintenance entries can be edited and deleted there too.
- No screenshot-reading (Claude API) or Etsy integration in v1 — those are explicitly deferred (see spec's "Later" section).
