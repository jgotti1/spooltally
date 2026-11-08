import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { gramsForLevel, type RollLevel } from "@/lib/inventory-constants";

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
  const q = query(rollsCollection(), where("ownerId", "==", ownerId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => {
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
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          } satisfies Roll;
        }),
      );
    },
    (error) => onError?.(error),
  );
}

export async function addRoll(ownerId: string, input: RollInput) {
  if (!db) throw configError;
  const remainingGrams = gramsForLevel(input.level, input.sizeGrams, input.quantity);
  await addDoc(rollsCollection(), {
    ownerId,
    brand: input.brand,
    material: input.material,
    color: input.color,
    sizeGrams: input.sizeGrams,
    price: input.price,
    level: input.level,
    quantity: input.level === "full" ? input.quantity : 1,
    remainingGrams,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateRoll(rollId: string, input: RollInput) {
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
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRoll(rollId: string) {
  if (!db) throw configError;
  await deleteDoc(doc(rollsCollection(), rollId));
}
