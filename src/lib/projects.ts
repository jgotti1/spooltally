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
};

export type Project = {
  id: string;
  ownerId: string;
  name: string;
  status: ProjectStatus;
  colorsNeeded: ProjectColorNeed[];
  files: ProjectFile[];
  estimateId: string | null;
  /** Optional — the nozzle size this was printed/sliced with, in mm. */
  nozzleSizeMm: number | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type ProjectInput = {
  name: string;
  status: ProjectStatus;
  colorsNeeded: ProjectColorNeed[];
  estimateId?: string | null;
  nozzleSizeMm?: number | null;
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
    estimateId: (data.estimateId as string | null) ?? null,
    nozzleSizeMm: (data.nozzleSizeMm as number | null) ?? null,
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

export async function addProject(ownerId: string, input: ProjectInput): Promise<string> {
  if (!db) throw configError;
  const ref = await addDoc(projectsCollection(), {
    ownerId,
    name: input.name,
    status: input.status,
    colorsNeeded: input.colorsNeeded,
    files: [],
    estimateId: input.estimateId ?? null,
    nozzleSizeMm: input.nozzleSizeMm ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProject(projectId: string, input: ProjectInput) {
  if (!db) throw configError;
  await updateDoc(doc(projectsCollection(), projectId), {
    name: input.name,
    status: input.status,
    colorsNeeded: input.colorsNeeded,
    ...(input.estimateId !== undefined ? { estimateId: input.estimateId } : {}),
    ...(input.nozzleSizeMm !== undefined ? { nozzleSizeMm: input.nozzleSizeMm } : {}),
    updatedAt: serverTimestamp(),
  });
}

/** Deletes a project, and with it any 0g placeholder rolls that only existed because this project needed them. */
export async function deleteProject(projectId: string) {
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
): Promise<ProjectFile> {
  if (!storage || !db) throw configError;
  const path = `projects/${ownerId}/${projectId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  const disposition = type === "model" ? "attachment" : "inline";
  await uploadBytes(storageRef, file, { contentDisposition: `${disposition}; filename="${file.name}"` });
  const url = await getDownloadURL(storageRef);
  const fileMeta: ProjectFile = { name: file.name, path, url, type, uploadedAt: Date.now() };
  await updateDoc(doc(projectsCollection(), projectId), {
    files: arrayUnion(fileMeta),
    updatedAt: serverTimestamp(),
  });
  return fileMeta;
}

export async function deleteProjectFile(projectId: string, file: ProjectFile) {
  if (!storage || !db) throw configError;
  await deleteObject(ref(storage, file.path)).catch(() => {});
  await updateDoc(doc(projectsCollection(), projectId), {
    files: arrayRemove(file),
    updatedAt: serverTimestamp(),
  });
}
