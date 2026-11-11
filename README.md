<p align="center">
  <img src="public/logo-full.png" alt="SpoolTally" width="340">
</p>

<p align="center">
  <strong>Track your filament. Price your prints. Keep tabs on projects.</strong><br>
  A web app for 3D print sellers: filament inventory, per-project pricing, and printer maintenance.
</p>

---

## What it does

SpoolTally has three day-to-day sections, plus the account and owner tooling that holds them together:

- **Inventory** — filament rolls by brand, material, color, and size, tracked by quarter-roll level (Full → Empty) down to the gram. Quick-add for restocking, and a reorder report that rolls same color/material rolls together.
- **Projects** — the single record for a print job: files, colors and grams needed (estimated from an STL or exact from a slicer file), linked inventory rolls, batch quantity, sales channel, full cost breakdown, and a suggested sale price. There's no separate "estimate" — pricing lives on the project.
- **Printer maintenance** — printers with a custom name and model, a due date you control directly, and a separate chronological log of finished service work. Due/overdue reminders surface on the dashboard and on the maintenance page.
- **Settings** — shop name, machine/labor/electricity rates, per-channel fee profiles (Etsy, eBay, Amazon Handmade, own site, Facebook Marketplace, in person), and inventory reorder thresholds.
- **Accounts & billing** — Firebase email/password + Google sign-in, a 14-day free trial that locks (not deletes) data when it lapses, and a Stripe-backed subscription (billing wiring is the last build step — see [Build order](#build-order)).
- **Owner/admin tools** — a user list and per-user detail page (comp, freeze, extend/set trial, grant admin, send account emails, delete an account), a read-only "view as" mode for support, a support inbox fed by the in-app contact form, and a system-wide history log with CSV export and retention purge.

Full functional spec: [spec.md](spec.md).

## Stack

| Layer | Choice |
|---|---|
| Frontend | [Next.js](https://nextjs.org) (App Router, TypeScript), deployed on [Vercel](https://vercel.com) |
| Auth | [Firebase Auth](https://firebase.google.com/docs/auth) — email/password + Google |
| Database | [Firestore](https://firebase.google.com/docs/firestore) |
| File storage | [Firebase Storage](https://firebase.google.com/docs/storage) (uploaded models + generated previews) |
| Admin backend | Next.js route handlers + the Firebase **Admin SDK** (no Cloud Functions needed) |
| Scheduled jobs | [Vercel Cron](https://vercel.com/docs/cron-jobs) (`vercel.json`) |
| Billing | Stripe Checkout + Customer Portal (not yet wired up) |
| 3D/file parsing | Three.js `STLLoader` for mesh volume; plain-code parsing for sliced 3MF/G-code headers — no external API |
| Outbound email | [Resend](https://resend.com) for support replies; Firebase's own mailer for password-reset/verification email |
| Styling | Tailwind CSS v4 |

## Getting started

Requires Node 20+.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 1. Create a Firebase project

In the [Firebase console](https://console.firebase.google.com):

1. Create a project, then add a **Web app** to it (Project settings → Your apps).
2. **Authentication** → Sign-in method → enable **Email/Password** and **Google**.
3. **Firestore Database** → create a database, then open the **Rules** tab and paste in the contents of [firestore.rules](firestore.rules). Click **Publish**.
4. **Storage** → create a default bucket, then publish [storage.rules](storage.rules) the same way.
5. (Optional, for the admin tools) **Project settings** → **Service accounts** → **Generate new private key**. Keep the downloaded JSON out of git — it's covered by `.gitignore`, but double-check.

### 2. Configure environment variables

Copy the example file and fill it in:

```bash
cp .env.local.example .env.local
```

| Variable | Required | What it's for |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` (6 values) | Yes | Web app config, from Project settings → Your apps → SDK setup and configuration |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | For admin tools | The service-account key JSON, **on one line**, pasted in as-is |
| `OWNER_EMAIL` | For admin tools | Your sign-in email; the first time this (verified) account signs in, it's granted `admin` + `owner` automatically |
| `RESEND_API_KEY` | For the contact form | Lets the server save support messages and notify you by email |
| `RESEND_FROM` | For admin replies | A sender on a domain verified in Resend (`"SpoolTally Support <support@yourdomain>"`) — only needed to reply to support messages by email |
| `CRON_SECRET` | Production only | Long random string (`openssl rand -hex 32`); lets Vercel's daily history-cleanup job call its own route. Not needed locally. |

`FIREBASE_SERVICE_ACCOUNT_JSON` is the one people usually trip over: open the downloaded key file, copy everything from `{` to `}`, and paste it as the value with no surrounding quotes and no line breaks. The app tolerates a few common pasting mistakes (wrapping quotes, a stray `VAR_NAME=` prefix, literal newlines inside the key), but a value that's missing or truncated won't parse.

### 3. Make yourself the owner

With `OWNER_EMAIL` set, just sign in with that email in the running app (email/password or Google, whichever that address uses) — it's granted automatically. Alternatively, run the included script by hand:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON="$(cat path/to/service-account.json)" node scripts/set-admin-claim.mjs you@example.com
```

Sign out and back in afterwards so your session picks up the new claim. The **Admin** link then appears in the header.

## Deploying

The app is built to run on Vercel.

1. Import the repo into a new Vercel project.
2. Add every variable from the table above in **Settings → Environment Variables** (Production, and Preview if you use it). Env changes only apply to deployments made *after* they're saved — redeploy once you've added them.
3. `vercel.json` schedules a daily job at `/api/cron/purge-history` (history retention, see below) — Vercel picks this up automatically once the project is deployed; it just needs `CRON_SECRET` set.
4. Firestore/Storage rules are published from the Firebase console, not from this repo — there's no Firebase CLI config checked in. Re-publish [firestore.rules](firestore.rules)/[storage.rules](storage.rules) whenever they change.

## Admin tools

Once you're signed in as the owner, `/admin` gives you:

- **Users** — every account, searchable and filterable by status (trial / paid / comped / behind on payment / locked), with comp, freeze, trial extension (relative or an exact date), admin grant, password-reset/verification emails, and permanent account deletion (typed email confirmation required).
- **View as** — open any user's account read-only to reproduce a problem; every write is blocked client- and server-side, and a banner makes it unmistakable which account you're looking at.
- **Support** — messages from the in-app contact form (including from signed-out/frozen users), as a list you double-click to open, reply to by email, and resolve.
- **History** — every admin action and key account event (signups, sign-ins, support messages), searchable, filterable, exportable as CSV, and kept for 90 days before a daily job purges older entries (purge can also be triggered by hand, owner-only).

Admin UI visibility is a convenience only — every `/api/admin/*` route re-checks the caller's Firebase custom claims server-side, and Firestore/Storage rules are the real backstop.

## Project structure

```
src/
  app/            Next.js routes (App Router) — pages and /api route handlers
    admin/        Owner-only pages: user list, user detail, support inbox, history
    api/admin/    Server routes behind requireAdmin()/requireOwner()
    api/cron/     Vercel Cron targets (history retention)
  components/     Shared UI (Header, forms, admin widgets, etc.)
  lib/            Firestore access, pricing math, account status, admin helpers
firestore.rules    Firestore security rules (published via the Firebase console)
storage.rules      Storage security rules (same)
vercel.json        Cron schedule
spec.md            Full product spec
```

## Build order

The product is being built in this sequence; later steps assume earlier ones are solid:

1. Rolls (inventory) + projects + low-filament report
2. Project pricing (slicer inputs, roll selection, costs, and suggested sale price)
3. Channel fee settings and pricing math
4. Login and trial
5. Contact support form
6. Stripe billing and admin page/reports

Admin tooling, the trial lock, and the support/history systems above were built ahead of billing to support the app while it's in beta; Stripe checkout itself is still outstanding.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve a production build |
| `npm run lint` | ESLint |
| `node scripts/set-admin-claim.mjs <email> [--remove]` | Grant or remove the owner's admin claim by hand |

---

Private project — not licensed for outside use.
