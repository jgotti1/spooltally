import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { assertWritable } from "@/lib/read-only";

const configError = new Error(
  "Firebase isn't configured yet. Add your project's keys to .env.local and restart the dev server.",
);

export type ShopSettings = {
  /** The seller's shop name (Etsy shop, brand, etc.) — used for personalization. */
  shopName: string;
  /** True once the user has answered or skipped the first-login "complete your profile" prompt. */
  profilePromptDone: boolean;
};

export const DEFAULT_SHOP_SETTINGS: ShopSettings = { shopName: "", profilePromptDone: false };

function settingsDoc(ownerId: string) {
  if (!db) throw configError;
  return doc(db, "settings", ownerId);
}

/** Shop details live on the same owner-scoped settings doc as pricing and inventory thresholds. */
export async function getShopSettings(ownerId: string): Promise<ShopSettings> {
  if (!db) throw configError;
  const snap = await getDoc(settingsDoc(ownerId));
  if (!snap.exists()) return DEFAULT_SHOP_SETTINGS;
  const data = snap.data();
  return {
    shopName: typeof data.shopName === "string" ? data.shopName : "",
    profilePromptDone: data.profilePromptDone === true,
  };
}

export async function saveShopSettings(ownerId: string, settings: Partial<ShopSettings>) {
  assertWritable();
  if (!db) throw configError;
  const data: Partial<ShopSettings> = {};
  if (settings.shopName !== undefined) data.shopName = settings.shopName.trim();
  if (settings.profilePromptDone !== undefined) data.profilePromptDone = settings.profilePromptDone;
  await setDoc(settingsDoc(ownerId), data, { merge: true });
}
