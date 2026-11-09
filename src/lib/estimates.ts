import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SalesChannelId } from "@/lib/estimator-constants";

const configError = new Error(
  "Firebase isn't configured yet. Add your project's keys to .env.local and restart the dev server.",
);

export type EstimateColorUsage = {
  material: string;
  color: string;
  grams: number;
  rollId: string | null;
  /** How `grams` was determined: "estimated" from an STL's volume, "exact" from a sliced 3MF/G-code file, or unset for manual entry. */
  gramsSource?: "estimated" | "exact";
};

export type Estimate = {
  id: string;
  ownerId: string;
  name: string;
  colorsUsed: EstimateColorUsage[];
  printHours: number;
  quantity: number;
  channelId: SalesChannelId;
  projectId: string | null;
  /** Total filament cost straight from the slicer (e.g. Bambu Studio's own "Cost" line), for the whole batch. When set, this is used instead of calculating filament cost from roll prices. */
  slicerFilamentCost: number | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type EstimateInput = {
  name: string;
  colorsUsed: EstimateColorUsage[];
  printHours: number;
  quantity: number;
  channelId: SalesChannelId;
  projectId: string | null;
  slicerFilamentCost: number | null;
};

function estimatesCollection() {
  if (!db) throw configError;
  return collection(db, "estimates");
}

function mapEstimate(id: string, data: Record<string, unknown>): Estimate {
  return {
    id,
    ownerId: data.ownerId as string,
    name: data.name as string,
    colorsUsed: (data.colorsUsed as EstimateColorUsage[]) ?? [],
    printHours: (data.printHours as number) ?? 0,
    quantity: (data.quantity as number) ?? 1,
    channelId: (data.channelId as SalesChannelId) ?? "etsy",
    projectId: (data.projectId as string | null) ?? null,
    slicerFilamentCost: (data.slicerFilamentCost as number | null) ?? null,
    createdAt: (data.createdAt as Timestamp) ?? null,
    updatedAt: (data.updatedAt as Timestamp) ?? null,
  };
}

export function subscribeToEstimates(
  ownerId: string,
  onChange: (estimates: Estimate[]) => void,
  onError?: (error: Error) => void,
) {
  if (!db) {
    onError?.(configError);
    return () => {};
  }
  const q = query(estimatesCollection(), where("ownerId", "==", ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const estimates = snapshot.docs.map((d) => mapEstimate(d.id, d.data()));
      estimates.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      onChange(estimates);
    },
    (error) => onError?.(error),
  );
}

export async function getEstimate(estimateId: string): Promise<Estimate | null> {
  if (!db) throw configError;
  const snap = await getDoc(doc(estimatesCollection(), estimateId));
  if (!snap.exists()) return null;
  return mapEstimate(snap.id, snap.data());
}

/** Firestore rejects any field holding a literal `undefined` (e.g. an optional field spread in but never set) — strip those before every write instead of relying on every caller to remember. */
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export async function addEstimate(ownerId: string, input: EstimateInput): Promise<string> {
  if (!db) throw configError;
  const ref = await addDoc(estimatesCollection(), {
    ownerId,
    ...stripUndefined(input),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEstimate(estimateId: string, input: EstimateInput) {
  if (!db) throw configError;
  await updateDoc(doc(estimatesCollection(), estimateId), {
    ...stripUndefined(input),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEstimate(estimateId: string) {
  if (!db) throw configError;
  await deleteDoc(doc(estimatesCollection(), estimateId));
}
