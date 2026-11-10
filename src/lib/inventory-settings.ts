import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { assertWritable } from "@/lib/read-only";

const configError = new Error(
  "Firebase isn't configured yet. Add your project's keys to .env.local and restart the dev server.",
);

export type InventorySettings = {
  reorderBelowRolls: number;
  warnAtRolls: number;
};

export const DEFAULT_INVENTORY_SETTINGS: InventorySettings = {
  reorderBelowRolls: 1,
  warnAtRolls: 1,
};

function settingsDoc(ownerId: string) {
  if (!db) throw configError;
  return doc(db, "settings", ownerId);
}

export async function getInventorySettings(ownerId: string): Promise<InventorySettings> {
  if (!db) throw configError;
  const snap = await getDoc(settingsDoc(ownerId));
  if (!snap.exists()) return DEFAULT_INVENTORY_SETTINGS;
  const data = snap.data();
  return {
    reorderBelowRolls: data.reorderBelowRolls ?? DEFAULT_INVENTORY_SETTINGS.reorderBelowRolls,
    warnAtRolls: data.warnAtRolls ?? DEFAULT_INVENTORY_SETTINGS.warnAtRolls,
  };
}

export async function saveInventorySettings(ownerId: string, settings: InventorySettings) {
  assertWritable();
  if (!db) throw configError;
  await setDoc(settingsDoc(ownerId), settings, { merge: true });
}
