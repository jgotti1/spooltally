// One-time (and repeatable) setup: gives an account the `admin` custom claim so it can use /admin.
//
//   FIREBASE_SERVICE_ACCOUNT_JSON="$(cat path/to/service-account.json)" node scripts/set-admin-claim.mjs you@example.com
//   ... add --remove to take the claim away again.
//
// The account you run this for becomes the OWNER: it gets both `admin` (use /admin) and `owner` (the only account that can
// grant or remove admin rights for other users from the admin page). Run it once, for yourself.
//
// Sign out and back in afterwards so your ID token picks the claim up.
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [email, flag] = process.argv.slice(2);
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!email || !raw) {
  console.error("Usage: FIREBASE_SERVICE_ACCOUNT_JSON=... node scripts/set-admin-claim.mjs <email> [--remove]");
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(raw)) });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
const claims = { ...(user.customClaims ?? {}) };
if (flag === "--remove") {
  delete claims.admin;
  delete claims.owner;
} else {
  claims.admin = true;
  claims.owner = true;
}
await auth.setCustomUserClaims(user.uid, claims);
console.log(`${flag === "--remove" ? "Removed" : "Granted"} admin + owner for ${email} (${user.uid}). Sign out and back in to refresh.`);
