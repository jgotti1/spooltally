import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { ProjectStatus } from "@/lib/inventory-constants";
import { deleteRoll, getRoll } from "@/lib/rolls";
import type { SalesChannelId } from "@/lib/estimator-constants";
import { assertWritable } from "@/lib/read-only";

const configError = new Error(
  "Firebase isn't configured yet. Add your project's keys to .env.local and restart the dev server.",
);

export type ProjectColorNeed = {
  material: string;
  color: string;
  gramsNeeded: number | null;
  rollIds: string[];
  /** How `gramsNeeded` was determined: "estimated" from an uploaded STL/3MF's geometry, "exact" from a sliced file, or unset for manual entry. */
  gramsSource?: "estimated" | "exact";
};

export type ProjectFileType = "model" | "image";

export type ProjectFile = {
  name: string;
  path: string;
  url: string;
  type: ProjectFileType;
  uploadedAt: number;
  /** Set when this image was generated automatically as the thumbnail for an uploaded model file. */
  generatedPreviewFor?: string;
};

/** Generated model thumbnails are supporting assets, not separate user uploads. */
export function isGeneratedProjectPreview(file: ProjectFile, files: ProjectFile[]): boolean {
  return (
    file.type === "image" &&
    files.some(
      (model) =>
        model.type === "model" &&
        (file.generatedPreviewFor === model.name || file.name === `${model.name}-preview.png`),
    )
  );
}

export function visibleProjectFiles(files: ProjectFile[]): ProjectFile[] {
  return files.filter((file) => !isGeneratedProjectPreview(file, files));
}

export type Project = {
  id: string;
  ownerId: string;
  name: string;
  status: ProjectStatus;
  colorsNeeded: ProjectColorNeed[];
  files: ProjectFile[];
  /** Optional — the nozzle size this was printed/sliced with, in mm. */
  nozzleSizeMm: number | null;
  printHours: number;
  quantity: number;
  channelId: SalesChannelId;
  /** Total filament cost straight from the slicer (e.g. Bambu Studio's own "Cost" line), for the whole batch. When set, this is used instead of calculating filament cost from roll prices. */
  slicerFilamentCost: number | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type ProjectInput = {
  name: string;
  status: ProjectStatus;
  colorsNeeded: ProjectColorNeed[];
  nozzleSizeMm?: number | null;
  printHours?: number;
  quantity?: number;
  channelId?: SalesChannelId;
  slicerFilamentCost?: number | null;
};

function projectsCollection() {
  if (!db) throw configError;
  return collection(db, "projects");
}

function mapProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    ownerId: data.ownerId as string,
    name: data.name as string,
    status: data.status as ProjectStatus,
    colorsNeeded: (data.colorsNeeded as ProjectColorNeed[]) ?? [],
    files: (data.files as ProjectFile[]) ?? [],
    nozzleSizeMm: (data.nozzleSizeMm as number | null) ?? null,
    printHours: (data.printHours as number) ?? 0,
    quantity: (data.quantity as number) ?? 1,
    channelId: (data.channelId as SalesChannelId) ?? "etsy",
    slicerFilamentCost: (data.slicerFilamentCost as number | null) ?? null,
    createdAt: (data.createdAt as Timestamp) ?? null,
    updatedAt: (data.updatedAt as Timestamp) ?? null,
  };
}

export function subscribeToProjects(
  ownerId: string,
  onChange: (projects: Project[]) => void,
  onError?: (error: Error) => void,
) {
  if (!db) {
    onError?.(configError);
    return () => {};
  }
  const q = query(projectsCollection(), where("ownerId", "==", ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const projects = snapshot.docs.map((d) => mapProject(d.id, d.data()));
      projects.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      onChange(projects);
    },
    (error) => onError?.(error),
  );
}

export async function getProject(projectId: string): Promise<Project | null> {
  if (!db) throw configError;
  const snap = await getDoc(doc(projectsCollection(), projectId));
  if (!snap.exists()) return null;
  return mapProject(snap.id, snap.data());
}

/** Firestore rejects any field holding a literal `undefined` (e.g. an optional field spread in but never set) — strip those before every write instead of relying on every caller to remember. */
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export async function addProject(ownerId: string, input: ProjectInput): Promise<string> {
  assertWritable();
  if (!db) throw configError;
  const ref = await addDoc(projectsCollection(), {
    ownerId,
    name: input.name,
    status: input.status,
    colorsNeeded: stripUndefined(input.colorsNeeded),
    files: [],
    nozzleSizeMm: input.nozzleSizeMm ?? null,
    printHours: input.printHours ?? 0,
    quantity: input.quantity ?? 1,
    channelId: input.channelId ?? "etsy",
    slicerFilamentCost: input.slicerFilamentCost ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProject(projectId: string, input: ProjectInput) {
  assertWritable();
  if (!db) throw configError;
  await updateDoc(doc(projectsCollection(), projectId), {
    name: input.name,
    status: input.status,
    colorsNeeded: stripUndefined(input.colorsNeeded),
    ...(input.nozzleSizeMm !== undefined ? { nozzleSizeMm: input.nozzleSizeMm } : {}),
    ...(input.printHours !== undefined ? { printHours: input.printHours } : {}),
    ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
    ...(input.channelId !== undefined ? { channelId: input.channelId } : {}),
    ...(input.slicerFilamentCost !== undefined ? { slicerFilamentCost: input.slicerFilamentCost } : {}),
    updatedAt: serverTimestamp(),
  });
}

/** Deletes a project, and with it any 0g placeholder rolls that only existed because this project needed them. */
export async function deleteProject(projectId: string) {
  assertWritable();
  if (!db) throw configError;
  const projectRef = doc(projectsCollection(), projectId);
  const snap = await getDoc(projectRef);

  if (snap.exists()) {
    const project = mapProject(snap.id, snap.data());
    const rollIds = Array.from(new Set(project.colorsNeeded.flatMap((need) => need.rollIds)));

    if (rollIds.length > 0) {
      const othersSnap = await getDocs(query(projectsCollection(), where("ownerId", "==", project.ownerId)));
      const stillNeededElsewhere = new Set<string>();
      for (const d of othersSnap.docs) {
        if (d.id === projectId) continue;
        for (const need of mapProject(d.id, d.data()).colorsNeeded) {
          for (const id of need.rollIds) stillNeededElsewhere.add(id);
        }
      }

      for (const rollId of rollIds) {
        if (stillNeededElsewhere.has(rollId)) continue;
        const roll = await getRoll(rollId).catch(() => null);
        if (roll && roll.remainingGrams === 0) {
          await deleteRoll(rollId).catch(() => {});
        }
      }
    }
  }

  await deleteDoc(projectRef);
}

export async function uploadProjectFile(
  ownerId: string,
  projectId: string,
  file: File,
  type: ProjectFileType,
  generatedPreviewFor?: string,
): Promise<ProjectFile> {
  assertWritable();
  if (!storage || !db) throw configError;
  const path = `projects/${ownerId}/${projectId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  const disposition = type === "model" ? "attachment" : "inline";
  await uploadBytes(storageRef, file, { contentDisposition: `${disposition}; filename="${file.name}"` });
  const url = await getDownloadURL(storageRef);
  const fileMeta: ProjectFile = {
    name: file.name,
    path,
    url,
    type,
    uploadedAt: Date.now(),
    ...(generatedPreviewFor ? { generatedPreviewFor } : {}),
  };
  await updateDoc(doc(projectsCollection(), projectId), {
    files: arrayUnion(fileMeta),
    updatedAt: serverTimestamp(),
  });
  return fileMeta;
}

export async function deleteProjectFile(projectId: string, file: ProjectFile) {
  assertWritable();
  if (!storage || !db) throw configError;
  await deleteObject(ref(storage, file.path)).catch(() => {});
  await updateDoc(doc(projectsCollection(), projectId), {
    files: arrayRemove(file),
    updatedAt: serverTimestamp(),
  });
}
