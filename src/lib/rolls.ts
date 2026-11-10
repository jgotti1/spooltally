import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { gramsForLevel, type RollLevel } from "@/lib/inventory-constants";
import { assertWritable } from "@/lib/read-only";

const configError = new Error(
  "Firebase isn't configured yet. Add your project's keys to .env.local and restart the dev server.",
);

export type Roll = {
  id: string;
  ownerId: string;
  brand: string;
  material: string;
  color: string;
  sizeGrams: number;
  price: number;
  level: RollLevel;
  quantity: number;
  remainingGrams: number;
  excludeFromReorder: boolean;
  /** Free-form note: lot number, where it was bought, print settings that worked… */
  notes: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type RollInput = {
  brand: string;
  material: string;
  color: string;
  sizeGrams: number;
  price: number;
  level: RollLevel;
  quantity: number;
  excludeFromReorder: boolean;
  notes?: string;
};

function rollsCollection() {
  if (!db) throw configError;
  return collection(db, "rolls");
}

export function subscribeToRolls(
  ownerId: string,
  onChange: (rolls: Roll[]) => void,
  onError?: (error: Error) => void,
) {
  if (!db) {
    onError?.(configError);
    return () => {};
  }
  const q = query(rollsCollection(), where("ownerId", "==", ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const rolls = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: data.ownerId,
          brand: data.brand,
          material: data.material,
          color: data.color,
          sizeGrams: data.sizeGrams,
          price: data.price,
          level: data.level,
          quantity: data.quantity,
          remainingGrams: data.remainingGrams,
          excludeFromReorder: data.excludeFromReorder ?? false,
      notes: typeof data.notes === "string" ? data.notes : "",
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
        } satisfies Roll;
      });
      rolls.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      onChange(rolls);
    },
    (error) => onError?.(error),
  );
}

export async function listRolls(ownerId: string): Promise<Roll[]> {
  if (!db) throw configError;
  const snapshot = await getDocs(query(rollsCollection(), where("ownerId", "==", ownerId)));
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ownerId: data.ownerId,
      brand: data.brand,
      material: data.material,
      color: data.color,
      sizeGrams: data.sizeGrams,
      price: data.price,
      level: data.level,
      quantity: data.quantity,
      remainingGrams: data.remainingGrams,
      excludeFromReorder: data.excludeFromReorder ?? false,
      notes: typeof data.notes === "string" ? data.notes : "",
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    } satisfies Roll;
  });
}

export async function getRoll(rollId: string): Promise<Roll | null> {
  if (!db) throw configError;
  const snap = await getDoc(doc(rollsCollection(), rollId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ownerId: data.ownerId,
    brand: data.brand,
    material: data.material,
    color: data.color,
    sizeGrams: data.sizeGrams,
    price: data.price,
    level: data.level,
    quantity: data.quantity,
    remainingGrams: data.remainingGrams,
    excludeFromReorder: data.excludeFromReorder ?? false,
      notes: typeof data.notes === "string" ? data.notes : "",
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function addRoll(ownerId: string, input: RollInput): Promise<string> {
  assertWritable();
  if (!db) throw configError;
  const remainingGrams = gramsForLevel(input.level, input.sizeGrams, input.quantity);
  const ref = await addDoc(rollsCollection(), {
    ownerId,
    brand: input.brand,
    material: input.material,
    color: input.color,
    sizeGrams: input.sizeGrams,
    price: input.price,
    level: input.level,
    quantity: input.level === "full" ? input.quantity : 1,
    remainingGrams,
    excludeFromReorder: input.excludeFromReorder,
    notes: (input.notes ?? "").trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRoll(rollId: string, input: RollInput) {
  assertWritable();
  if (!db) throw configError;
  const remainingGrams = gramsForLevel(input.level, input.sizeGrams, input.quantity);
  await updateDoc(doc(rollsCollection(), rollId), {
    brand: input.brand,
    material: input.material,
    color: input.color,
    sizeGrams: input.sizeGrams,
    price: input.price,
    level: input.level,
    quantity: input.level === "full" ? input.quantity : 1,
    remainingGrams,
    excludeFromReorder: input.excludeFromReorder,
    notes: (input.notes ?? "").trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function setRollReorderExclusion(rollId: string, excludeFromReorder: boolean) {
  assertWritable();
  if (!db) throw configError;
  await updateDoc(doc(rollsCollection(), rollId), {
    excludeFromReorder,
    updatedAt: serverTimestamp(),
  });
}

export async function incrementRollQuantity(rollId: string, addQuantity: number, sizeGrams: number) {
  assertWritable();
  if (!db) throw configError;
  await updateDoc(doc(rollsCollection(), rollId), {
    quantity: increment(addQuantity),
    remainingGrams: increment(addQuantity * sizeGrams),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRoll(rollId: string) {
  assertWritable();
  if (!db) throw configError;
  await deleteDoc(doc(rollsCollection(), rollId));
}
