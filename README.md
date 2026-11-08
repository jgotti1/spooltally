# SpoolTally

Web app for 3D print sellers: price estimation, filament inventory, and project tracking.

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

## Build order

1. Rolls (inventory) + projects + low-filament report
2. Estimator (manual, STL, 3MF/G-code) + roll selection + save-as-project
3. Channel fee settings and pricing math
4. Login and trial
5. Contact support form
6. Stripe billing and admin page/reports
