import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const configError = new Error(
  "Firebase isn't configured yet. Add your project's keys to .env.local and restart the dev server.",
);

export const OTHER_PRINTER_MODEL = "Other / custom model";

export const PRINTER_MODEL_GROUPS = [
  {
    brand: "Bambu Lab",
    models: [
      "Bambu Lab A1 Mini",
      "Bambu Lab A1",
      "Bambu Lab P1P",
      "Bambu Lab P1S",
      "Bambu Lab P2S",
      "Bambu Lab X1 Carbon",
      "Bambu Lab X1E",
      "Bambu Lab H2D",
      "Bambu Lab H2S",
      "Bambu Lab H2C",
    ],
  },
  {
    brand: "Prusa",
    models: ["Prusa MINI+", "Prusa MK3S+", "Prusa MK4S", "Prusa XL", "Prusa CORE One"],
  },
  {
    brand: "Creality",
    models: ["Creality Ender-3 V3 SE", "Creality Ender-3 V3 KE", "Creality Ender-3 V3", "Creality K1", "Creality K1C", "Creality K1 Max"],
  },
  {
    brand: "Elegoo",
    models: ["Elegoo Neptune 4", "Elegoo Neptune 4 Pro", "Elegoo Neptune 4 Plus", "Elegoo Neptune 4 Max", "Elegoo Centauri Carbon", "Elegoo Saturn 4 Ultra"],
  },
  {
    brand: "Anycubic",
    models: ["Anycubic Kobra 2 Pro", "Anycubic Kobra 2 Max", "Anycubic Kobra 3", "Anycubic Kobra S1", "Anycubic Photon Mono M5s"],
  },
  {
    brand: "Sovol",
    models: ["Sovol SV06", "Sovol SV06 Plus", "Sovol SV07", "Sovol SV08"],
  },
  {
    brand: "FlashForge",
    models: ["FlashForge Adventurer 5M", "FlashForge Adventurer 5M Pro", "FlashForge Creator 4"],
  },
  {
    brand: "QIDI",
    models: ["QIDI Q1 Pro", "QIDI Plus4", "QIDI X-Max 3", "QIDI X-Plus 3"],
  },
  {
    brand: "Professional / resin",
    models: ["Formlabs Form 4", "Raise3D Pro3", "UltiMaker S5", "UltiMaker S7"],
  },
] as const;

export type Printer = {
  id: string;
  ownerId: string;
  name: string;
  model: string;
  /** The printer's own next-due date — set independently of logging completed maintenance. "" means unscheduled. */
  nextDueDate: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

/** A log entry for work actually performed — it has no due-date field of its own; scheduling lives on the printer, not on history. */
export type MaintenanceRecord = {
  id: string;
  ownerId: string;
  printerId: string;
  completedDate: string;
  notes: string;
  createdAt: Timestamp | null;
};

function printersCollection() {
  if (!db) throw configError;
  return collection(db, "printers");
}

function maintenanceRecordsCollection() {
  if (!db) throw configError;
  return collection(db, "maintenanceRecords");
}

export function subscribeToPrinters(
  ownerId: string,
  onChange: (printers: Printer[]) => void,
  onError?: (error: Error) => void,
) {
  if (!db) {
    onError?.(configError);
    return () => {};
  }
  return onSnapshot(
    query(printersCollection(), where("ownerId", "==", ownerId)),
    (snapshot) => {
      const printers = snapshot.docs.map((printerDoc) => {
        const data = printerDoc.data();
        return {
          id: printerDoc.id,
          ownerId: data.ownerId,
          name: data.name,
          model: data.model,
          nextDueDate: data.nextDueDate ?? "",
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
        } satisfies Printer;
      });
      printers.sort((a, b) => a.name.localeCompare(b.name));
      onChange(printers);
    },
    (error) => onError?.(error),
  );
}

export function subscribeToMaintenanceRecords(
  ownerId: string,
  onChange: (records: MaintenanceRecord[]) => void,
  onError?: (error: Error) => void,
) {
  if (!db) {
    onError?.(configError);
    return () => {};
  }
  return onSnapshot(
    query(maintenanceRecordsCollection(), where("ownerId", "==", ownerId)),
    (snapshot) => {
      const records = snapshot.docs.map((recordDoc) => {
        const data = recordDoc.data();
        return {
          id: recordDoc.id,
          ownerId: data.ownerId,
          printerId: data.printerId,
          completedDate: data.completedDate,
          notes: data.notes,
          createdAt: data.createdAt ?? null,
        } satisfies MaintenanceRecord;
      });
      records.sort((a, b) => {
        const byDate = b.completedDate.localeCompare(a.completedDate);
        if (byDate !== 0) return byDate;
        return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0);
      });
      onChange(records);
    },
    (error) => onError?.(error),
  );
}

export async function addPrinter(
  ownerId: string,
  input: { name: string; model: string; nextDueDate?: string },
): Promise<string> {
  if (!db) throw configError;
  const printerRef = await addDoc(printersCollection(), {
    ownerId,
    name: input.name.trim(),
    model: input.model.trim(),
    nextDueDate: input.nextDueDate ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return printerRef.id;
}

/** Schedules (or clears, with "") a printer's next due date — independent of logging any completed maintenance. */
export async function updatePrinterNextDueDate(printerId: string, nextDueDate: string): Promise<void> {
  if (!db) throw configError;
  await updateDoc(doc(printersCollection(), printerId), {
    nextDueDate,
    updatedAt: serverTimestamp(),
  });
}

export async function addMaintenanceRecord(
  ownerId: string,
  input: { printerId: string; completedDate: string; notes: string },
): Promise<string> {
  if (!db) throw configError;
  const recordRef = await addDoc(maintenanceRecordsCollection(), {
    ownerId,
    printerId: input.printerId,
    completedDate: input.completedDate,
    notes: input.notes.trim(),
    createdAt: serverTimestamp(),
  });
  return recordRef.id;
}

/**
 * Marks a printer's scheduled job as done: logs the finished work and, in the same batch, replaces the printer's
 * next-due date (with `nextDueDate`, or "" to leave it unscheduled). It's one explicit action by the user — due
 * status is still read only from the printer's own `nextDueDate`, never derived from history.
 */
export async function completeScheduledMaintenance(
  ownerId: string,
  input: { printerId: string; completedDate: string; notes: string; nextDueDate?: string },
): Promise<string> {
  if (!db) throw configError;
  const batch = writeBatch(db);
  const recordRef = doc(maintenanceRecordsCollection());
  batch.set(recordRef, {
    ownerId,
    printerId: input.printerId,
    completedDate: input.completedDate,
    notes: input.notes.trim(),
    createdAt: serverTimestamp(),
  });
  batch.update(doc(printersCollection(), input.printerId), {
    nextDueDate: input.nextDueDate ?? "",
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return recordRef.id;
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatMaintenanceDate(value: string): string {
  if (!value) return "Not scheduled";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function latestMaintenanceByPrinter(records: MaintenanceRecord[]): Map<string, MaintenanceRecord> {
  const latest = new Map<string, MaintenanceRecord>();
  for (const record of records) {
    if (!latest.has(record.printerId)) latest.set(record.printerId, record);
  }
  return latest;
}

/** Printers due within this many days are called out separately from ones with plenty of runway. */
export const MAINTENANCE_UPCOMING_WINDOW_DAYS = 30;

export type MaintenanceDueStatus = "overdue" | "due" | "upcoming" | "scheduled" | "unscheduled";

export function maintenanceDueStatus(nextDueDate: string | undefined, today = localDateString()): MaintenanceDueStatus {
  if (!nextDueDate) return "unscheduled";
  if (nextDueDate < today) return "overdue";
  if (nextDueDate === today) return "due";
  const todayDate = new Date(`${today}T12:00:00`);
  const dueDate = new Date(`${nextDueDate}T12:00:00`);
  const daysUntilDue = Math.round((dueDate.getTime() - todayDate.getTime()) / 86_400_000);
  if (daysUntilDue <= MAINTENANCE_UPCOMING_WINDOW_DAYS) return "upcoming";
  return "scheduled";
}

/** True for anything that needs attention soon — overdue, due today, or due within the upcoming window. */
export function isMaintenanceSoon(status: MaintenanceDueStatus): boolean {
  return status === "overdue" || status === "due" || status === "upcoming";
}

