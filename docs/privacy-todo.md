# Privacy to-do list (before opening SpoolTally as a SaaS)

Reviewed 2026-11-11. This is an engineering checklist, not legal advice — have a lawyer or a reputable policy generator review the policy text before launch.

## Already in good shape

- Fonts are self-hosted by `next/font` (no requests to Google's font servers).
- No analytics, ad pixels, or third-party scripts.
- Browser storage is limited to strictly necessary items: theme (`localStorage`), the admin's view-as marker (`sessionStorage`), and Firebase's sign-in session — so a cookie banner is probably not needed.
- Owner's support address stays server-side; private notes and the history log are server-only collections customers can never read.
- View-as is read-only and logged; history is purged after 90 days.
- Google profile photos load with `referrerPolicy="no-referrer"`.

## To do, in priority order

- [ ] **1. Privacy Policy and Terms pages.** None exist. Needed for customers, and Stripe and Google's sign-in consent screen require them. Draft the text to match what the app actually does (see the processor list in item 5), then get it reviewed.
- [ ] **2. Self-service delete and export.** Only an admin can delete an account today. Add "Delete my account" and "Download my data" to `/settings` (GDPR/CCPA rights). Reuse the deletion logic in `DELETE /api/admin/users/[uid]`, but gated to the signed-in user's own uid with a typed confirmation.
- [ ] **3. Close the deletion and retention gaps.**
  - Support messages sent while signed out are saved with `ownerId: ""`, so account deletion never removes them. Add an admin "erase by email" tool.
  - `supportMessages` are kept forever. Pick a retention period (for example, delete resolved messages after 12–24 months) and extend the daily cron job to enforce it.
  - Account deletion leaves history entries containing the email for up to 90 days. Acceptable, but state it in the policy.
- [ ] **4. Uploaded files use public links.** Model files and photos are served by Firebase `getDownloadURL` links, which work for anyone holding the link without signing in and bypass Storage rules. Move to short-lived signed URLs (or authenticated reads) so sellers' designs stay private.
- [ ] **5. Processors and data location.** Customer data passes through Google (Firebase Auth, Firestore, Storage, Google sign-in), Vercel (hosting and logs), Resend (email), and Stripe (billing, once added). List them in the policy and accept each one's data-processing agreement. Check the Firestore region in the Firebase console (it can't be changed later) — it matters for EU customers.
- [ ] **6. Admin access disclosure.** Admins can see every customer's email, name, and data, and can view as them. It's logged and owner-gated; disclose it in the policy and keep the admin list short.

## Notes

- Also relevant when Stripe is added: never store card details (Checkout/Portal only), and keep the verified-email requirement for subscribing (see CLAUDE.md, "Billing rules").
