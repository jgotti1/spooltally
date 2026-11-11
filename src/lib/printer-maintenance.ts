import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  deleteDoc,
  getDocs,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { assertWritable } from "@/lib/read-only";

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
  /** Optional running total of print hours on the printer. Informational — it never affects due status. */
  currentHours: number | null;
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
  /** Optional: the printer's total print hours at the time of the service. */
  printerHours: number | null;
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
          currentHours: typeof data.currentHours === "number" ? data.currentHours : null,
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
          printerHours: typeof data.printerHours === "number" ? data.printerHours : null,
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
  input: { name: string; model: string; nextDueDate?: string; currentHours?: number | null },
): Promise<string> {
  assertWritable();
  if (!db) throw configError;
  const printerRef = await addDoc(printersCollection(), {
    ownerId,
    name: input.name.trim(),
    model: input.model.trim(),
    nextDueDate: input.nextDueDate ?? "",
    currentHours: input.currentHours ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return printerRef.id;
}

/** Schedules (or clears, with "") a printer's next due date — independent of logging any completed maintenance. */
export async function updatePrinterNextDueDate(printerId: string, nextDueDate: string): Promise<void> {
  assertWritable();
  if (!db) throw configError;
  await updateDoc(doc(printersCollection(), printerId), {
    nextDueDate,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Turns the text of an hours field into a reading: blank (or anything that isn't a number of 0 or more) means "not
 * entered" and is stored as null. One decimal place is kept, which is plenty for a print-hours counter.
 */
export function parseHours(value: string): number | null {
  if (!value.trim()) return null;
  const hours = Number(value);
  return Number.isFinite(hours) && hours >= 0 ? Math.round(hours * 10) / 10 : null;
}

export function formatHours(hours: number): string {
  return `${hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
}

/**
 * The printer's running total after a new reading: hours only move forward, so logging an older or back-dated service
 * with a lower reading never rolls the printer's total back (correct it from the printer's Edit panel instead).
 */
function advancedHours(existing: unknown, reading: number | null): number | null {
  const current = typeof existing === "number" ? existing : null;
  if (reading === null) return current;
  return current === null ? reading : Math.max(current, reading);
}

export async function addMaintenanceRecord(
  ownerId: string,
  input: { printerId: string; completedDate: string; notes: string; printerHours?: number | null },
): Promise<string> {
  assertWritable();
  if (!db) throw configError;
  const firestore = db;
  const recordRef = doc(maintenanceRecordsCollection());
  const printerRef = doc(printersCollection(), input.printerId);
  const reading = input.printerHours ?? null;
  // One transaction so the service entry and the printer's running total can never disagree.
  await runTransaction(firestore, async (transaction) => {
    const printerSnap = reading === null ? null : await transaction.get(printerRef);
    transaction.set(recordRef, {
      ownerId,
      printerId: input.printerId,
      completedDate: input.completedDate,
      notes: input.notes.trim(),
      printerHours: reading,
      createdAt: serverTimestamp(),
    });
    if (printerSnap) {
      transaction.update(printerRef, {
        currentHours: advancedHours(printerSnap.data()?.currentHours, reading),
        updatedAt: serverTimestamp(),
      });
    }
  });
  return recordRef.id;
}

/**
 * Renames a printer, changes its model, or sets its current print hours (null clears them, undefined leaves them as
 * they are); the due date and history are untouched.
 */
export async function updatePrinterDetails(
  printerId: string,
  input: { name: string; model: string; currentHours?: number | null },
): Promise<void> {
  assertWritable();
  if (!db) throw configError;
  await updateDoc(doc(printersCollection(), printerId), {
    name: input.name.trim(),
    model: input.model.trim(),
    ...(input.currentHours !== undefined ? { currentHours: input.currentHours } : {}),
    updatedAt: serverTimestamp(),
  });
}

/** Deletes a printer together with every maintenance record that belongs to it. */
export async function deletePrinter(ownerId: string, printerId: string): Promise<void> {
  assertWritable();
  if (!db) throw configError;
  const records = await getDocs(
    query(maintenanceRecordsCollection(), where("ownerId", "==", ownerId), where("printerId", "==", printerId)),
  );
  const batch = writeBatch(db);
  for (const record of records.docs) batch.delete(record.ref);
  batch.delete(doc(printersCollection(), printerId));
  await batch.commit();
}

export async function updateMaintenanceRecord(
  recordId: string,
  input: { completedDate: string; notes: string; printerHours?: number | null },
): Promise<void> {
  assertWritable();
  if (!db) throw configError;
  await updateDoc(doc(maintenanceRecordsCollection(), recordId), {
    completedDate: input.completedDate,
    notes: input.notes.trim(),
    ...(input.printerHours !== undefined ? { printerHours: input.printerHours } : {}),
  });
}

export async function deleteMaintenanceRecord(recordId: string): Promise<void> {
  assertWritable();
  if (!db) throw configError;
  await deleteDoc(doc(maintenanceRecordsCollection(), recordId));
}

/**
 * Marks a printer's scheduled job as done: logs the finished work and, in the same batch, replaces the printer's
 * next-due date (with `nextDueDate`, or "" to leave it unscheduled). It's one explicit action by the user — due
 * status is still read only from the printer's own `nextDueDate`, never derived from history.
 */
export async function completeScheduledMaintenance(
  ownerId: string,
  input: { printerId: string; completedDate: string; notes: string; nextDueDate?: string; printerHours?: number | null },
): Promise<string> {
  assertWritable();
  if (!db) throw configError;
  const firestore = db;
  const recordRef = doc(maintenanceRecordsCollection());
  const printerRef = doc(printersCollection(), input.printerId);
  const reading = input.printerHours ?? null;
  await runTransaction(firestore, async (transaction) => {
    const printerSnap = reading === null ? null : await transaction.get(printerRef);
    transaction.set(recordRef, {
      ownerId,
      printerId: input.printerId,
      completedDate: input.completedDate,
      notes: input.notes.trim(),
      printerHours: reading,
      createdAt: serverTimestamp(),
    });
    transaction.update(printerRef, {
      nextDueDate: input.nextDueDate ?? "",
      ...(printerSnap ? { currentHours: advancedHours(printerSnap.data()?.currentHours, reading) } : {}),
      updatedAt: serverTimestamp(),
    });
  });
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

