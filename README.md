# SpoolTally

Web app for 3D print sellers: price estimation, filament inventory, project tracking, and printer maintenance.

Full product spec: [spec.md](spec.md).

## Stack

- **Frontend:** Next.js (TypeScript), deployed on Vercel.
- **Auth:** Firebase Auth — email/password + Google sign-in.
- **Database:** Firestore.
- **Backend logic:** Firebase Cloud Functions.
- **Billing:** Stripe Checkout + Customer Portal, synced to Firestore via Stripe's Firebase extension.
- **3D/file parsing:** Three.js `STLLoader` for mesh volume; plain-code parsing for sliced 3MF/G-code headers.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Copy `.env.local.example` to `.env.local` and fill in your Firebase project's web app config (Firebase Console → Project settings → Your apps):

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

In Firebase Console → Authentication → Sign-in method, enable the **Email/Password** and **Google** providers.

## Product model

SpoolTally has three primary areas: Inventory, Projects, and Printer Maintenance. Pricing is part of each project; there is no separate Estimate route or Firestore collection.

- Every project color must be matched to an inventory roll. A new roll can be added inline when needed.
- Slicer filament cost is entered as a batch total and overrides filament cost calculated from roll price and size. The app shows total batch cost and cost per unit; suggested sale prices start at 2.5× complete per-unit cost and then account for channel fees.
- Project grid and list previews summarize cost, filament, colors, nozzle, print time, quantity, channel, and uploaded-file count.
- Generated model thumbnails support previews but are not displayed or counted as separate user uploads.
- Sales channels: Etsy, eBay, Amazon Handmade, own site, Facebook Marketplace, and in person.
- Printer Maintenance supports custom printer names and a common-model dropdown with an Other/custom choice. Logging finished work and scheduling the next due date are independent actions — a printer's due date can be set or changed any time without requiring a completed-maintenance entry. Due reminders appear on both the dashboard and maintenance page. The printer list has block and list views; double-clicking a printer opens a detail panel with its full service history and due-date editor.

## Build order

1. Rolls (inventory) + projects + low-filament report
2. Project pricing (slicer inputs, roll selection, costs, and suggested sale price)
3. Channel fee settings and pricing math
4. Login and trial
5. Contact support form
6. Stripe billing and admin page/reports
