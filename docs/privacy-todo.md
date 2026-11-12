# Privacy to-do list (before opening SpoolTally as a SaaS)

Reviewed 2026-11-11. This is an engineering checklist, not legal advice — have a lawyer or a reputable policy generator review the policy text before launch.

## Already in good shape

- Fonts are self-hosted by `next/font` (no requests to Google's font servers).
- No analytics, ad pixels, or third-party scripts.
- Browser storage is limited to strictly necessary items: theme (`localStorage`), the admin's view-as marker (`sessionStorage`), and Firebase's sign-in session — so a cookie banner is probably not needed.
- Owner's support address stays server-side; private notes and the history log are server-only collections customers can never read.
- View-as is read-only and logged; history is purged after 90 days.
- Google profile photos load with `referrerPolicy="no-referrer"`.
- In-app privacy summary (Settings → Privacy, linked from the profile menu) that every account must acknowledge before using the app. The acknowledgment is recorded server-side with a version and timestamp, shown on the admin user page, and logged to history; bump `PRIVACY_VERSION` to re-prompt everyone (done 2026-11-11).

## To do, in priority order

- [ ] **1. Privacy Policy and Terms pages.** None exist. Needed for customers, and Stripe and Google's sign-in consent screen require them. Draft the text to match what the app actually does (see the processor list in item 5), then get it reviewed.
  - *Progress:* the in-app Privacy tab and required acknowledgment exist, but they are a plain-language summary, not these pages.
  - *Still needed:* standalone, public Privacy Policy and Terms pages, and real links to them — the Terms and Privacy links in the sign-in page footer are still placeholders (`#`).
- [ ] **1b. Inactive-account deletion (6 months).** The in-app Privacy tab (version 2, 2026-11-11) already promises that an account inactive for 6 months (trial or subscription ended, no return) is deleted with all its data, without notice. **The logic does not exist yet.** Build: a daily cron (extend `/api/cron/purge-history` or add one) that finds expired/ended accounts with no sign-in for 6 months and runs the same deletion as `DELETE /api/admin/users/[uid]` (and cancels the Stripe subscription). Skip comped accounts, the owner, and admins. Owner decisions (2026-11-11): the window is 6 months and purging is without notice, so no reminder emails will be built and the Privacy text must not promise one; do show a clear notice on `/subscribe` and at trial end when Stripe lands. Until built, the privacy text overstates what the app does.
- [x] **1c. Purge window.** *Decided 2026-11-11:* 6 months of inactivity, purged without notice (the 90-day history/sign-in retention periods are unrelated and unchanged). Revisit only if it needs to be longer for former paying customers.
- [ ] **2. Self-service delete and export.** Only an admin can delete an account today. Add "Delete my account" and "Download my data" to `/settings` (GDPR/CCPA rights). Reuse the deletion logic in `DELETE /api/admin/users/[uid]`, but gated to the signed-in user's own uid with a typed confirmation.
- [ ] **3. Close the deletion and retention gaps.**
  - Support messages sent while signed out are saved with `ownerId: ""`, so account deletion never removes them. Add an admin "erase by email" tool.
  - `supportMessages` are kept forever. Pick a retention period (for example, delete resolved messages after 12–24 months) and extend the daily cron job to enforce it.
  - Account deletion leaves history entries containing the email for up to 90 days. Acceptable, but state it in the policy.
- [ ] **4. Uploaded files use public links.** Model files and photos are served by Firebase `getDownloadURL` links, which work for anyone holding the link without signing in and bypass Storage rules. Move to short-lived signed URLs (or authenticated reads) so sellers' designs stay private.
- [ ] **5. Processors and data location.** Customer data passes through Google (Firebase Auth, Firestore, Storage, Google sign-in), Vercel (hosting and logs), Resend (email), and Stripe (billing, once added). List them in the policy and accept each one's data-processing agreement. Check the Firestore region in the Firebase console (it can't be changed later) — it matters for EU customers.
  - *Progress:* the processors (Firebase, Vercel, Resend, Stripe) are listed in the in-app Privacy tab.
  - *Still needed:* accept each provider's data-processing agreement, check the Firestore region, and carry the list into the policy.
- [x] **6. Admin access disclosure.** *Done 2026-11-11:* the in-app Privacy tab and the required acknowledgment screen tell customers the owner can open their account in a read-only view and that each access is logged. Ongoing: keep the admin list short, and repeat the disclosure in the Privacy Policy when item 1 is written.
  - Original note: admins can see every customer's email, name, and data, and can view as them. It's logged and owner-gated.

## Notes

- Also relevant when Stripe is added: never store card details (Checkout/Portal only), and keep the verified-email requirement for subscribing (see CLAUDE.md, "Billing rules").
