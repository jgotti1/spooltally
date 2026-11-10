"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  addMaintenanceRecord,
  addPrinter,
  completeScheduledMaintenance,
  deleteMaintenanceRecord,
  deletePrinter,
  formatMaintenanceDate,
  isMaintenanceSoon,
  latestMaintenanceByPrinter,
  localDateString,
  maintenanceDueStatus,
  MAINTENANCE_UPCOMING_WINDOW_DAYS,
  OTHER_PRINTER_MODEL,
  PRINTER_MODEL_GROUPS,
  subscribeToMaintenanceRecords,
  subscribeToPrinters,
  updateMaintenanceRecord,
  updatePrinterDetails,
  updatePrinterNextDueDate,
  type MaintenanceRecord,
  type Printer,
} from "@/lib/printer-maintenance";

type PrinterMaintenanceProps = {
  ownerId: string;
};

function GridIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <rect x="3" y="3" width="6" height="6" rx="1.3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ListViewIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M4 5.5h12M4 10h12M4 14.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
      <path
        d="M14.5 6.5a4.5 4.5 0 0 0-5.8 5.8L3.5 17.5a2.1 2.1 0 0 0 3 3l5.2-5.2a4.5 4.5 0 0 0 5.8-5.8l-2.7 2.7-3-3 2.7-2.7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STATUS_STYLES = {
  overdue: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  due: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  upcoming: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  scheduled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  unscheduled: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
} as const;

function statusLabel(status: keyof typeof STATUS_STYLES, nextDueDate: string): string {
  if (status === "overdue") return `Overdue · ${formatMaintenanceDate(nextDueDate)}`;
  if (status === "due") return "Due today";
  if (status === "upcoming") return `Due soon · ${formatMaintenanceDate(nextDueDate)}`;
  if (status === "scheduled") return `Due ${formatMaintenanceDate(nextDueDate)}`;
  return "No next date set";
}

export function PrinterMaintenance({ ownerId }: PrinterMaintenanceProps) {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [printerName, setPrinterName] = useState("");
  const [printerModel, setPrinterModel] = useState(PRINTER_MODEL_GROUPS[0].models[0] as string);
  const [customModel, setCustomModel] = useState("");
  const [savingPrinter, setSavingPrinter] = useState(false);

  const [recordMode, setRecordMode] = useState<"completed" | "schedule">("completed");
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const [completedDate, setCompletedDate] = useState(() => localDateString());
  const [notes, setNotes] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [savingRecord, setSavingRecord] = useState(false);

  const [viewMode, setViewMode] = useState<"block" | "list">("block");
  const [detailPrinterId, setDetailPrinterId] = useState<string | null>(null);
  const [detailDueDate, setDetailDueDate] = useState("");
  const [savingDueDate, setSavingDueDate] = useState(false);

  // "Mark complete" form for the printer's scheduled job, inside the detail panel.
  const [completing, setCompleting] = useState(false);
  const [completeDate, setCompleteDate] = useState(() => localDateString());
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeNextDate, setCompleteNextDate] = useState("");
  const [completeError, setCompleteError] = useState("");
  const [savingComplete, setSavingComplete] = useState(false);

  // Rename / re-model / delete the printer from its panel.
  const [editingPrinter, setEditingPrinter] = useState(false);
  const [editName, setEditName] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editCustomModel, setEditCustomModel] = useState("");
  const [savingPrinter_, setSavingPrinter_] = useState(false);

  // Fix a typo in a finished entry, or remove one logged by mistake.
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editRecordDate, setEditRecordDate] = useState("");
  const [editRecordNotes, setEditRecordNotes] = useState("");
  const [savingRecordEdit, setSavingRecordEdit] = useState(false);

  useEffect(() => {
    const unsubscribePrinters = subscribeToPrinters(
      ownerId,
      (next) => {
        setPrinters(next);
        setLoading(false);
      },
      (subscriptionError) => {
        setError(subscriptionError.message || "Couldn't load printers.");
        setLoading(false);
      },
    );
    const unsubscribeRecords = subscribeToMaintenanceRecords(
      ownerId,
      setRecords,
      (subscriptionError) => setError(subscriptionError.message || "Couldn't load maintenance history."),
    );
    return () => {
      unsubscribePrinters();
      unsubscribeRecords();
    };
  }, [ownerId]);

  const latestByPrinter = useMemo(() => latestMaintenanceByPrinter(records), [records]);
  const maintenancePrinterId = printers.some((printer) => printer.id === selectedPrinterId)
    ? selectedPrinterId
    : (printers[0]?.id ?? "");
  const recordsByPrinter = useMemo(() => {
    const grouped = new Map<string, MaintenanceRecord[]>();
    for (const record of records) {
      const existing = grouped.get(record.printerId) ?? [];
      existing.push(record);
      grouped.set(record.printerId, existing);
    }
    return grouped;
  }, [records]);
  /** Overdue, due today, or due within the upcoming window — everything worth surfacing up top. */
  const duePrinters = useMemo(
    () => printers.filter((printer) => isMaintenanceSoon(maintenanceDueStatus(printer.nextDueDate))),
    [printers],
  );
  const urgentDuePrinters = useMemo(
    () =>
      duePrinters.filter((printer) => {
        const status = maintenanceDueStatus(printer.nextDueDate);
        return status === "overdue" || status === "due";
      }),
    [duePrinters],
  );

  function printerDueLabel(printer: Printer): string {
    return printer.nextDueDate ? `${printer.name} (${formatMaintenanceDate(printer.nextDueDate)})` : printer.name;
  }

  const detailPrinter = printers.find((printer) => printer.id === detailPrinterId) ?? null;

  useEffect(() => {
    if (!detailPrinterId) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDetailPrinterId(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailPrinterId]);

  useEffect(() => {
    if (!detailPrinterId) return;
    // Sync only when the modal switches to a different printer, not on every live data refresh —
    // otherwise an in-progress edit here would get clobbered by an unrelated snapshot update.
    const current = printers.find((printer) => printer.id === detailPrinterId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetailDueDate(current?.nextDueDate ?? "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompleting(false);
    setCompleteError("");
    setEditingPrinter(false);
    setEditingRecordId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailPrinterId]);

  const knownModels = PRINTER_MODEL_GROUPS.flatMap((group) => group.models as readonly string[]);

  function startEditingPrinter() {
    if (!detailPrinter) return;
    setEditName(detailPrinter.name);
    if (knownModels.includes(detailPrinter.model)) {
      setEditModel(detailPrinter.model);
      setEditCustomModel("");
    } else {
      setEditModel(OTHER_PRINTER_MODEL);
      setEditCustomModel(detailPrinter.model);
    }
    setEditingPrinter(true);
  }

  async function handleSavePrinterDetails(event: FormEvent) {
    event.preventDefault();
    if (!detailPrinter) return;
    const model = editModel === OTHER_PRINTER_MODEL ? editCustomModel.trim() : editModel;
    if (!editName.trim() || !model) return;
    setSavingPrinter_(true);
    setError("");
    try {
      await updatePrinterDetails(detailPrinter.id, { name: editName, model });
      setEditingPrinter(false);
      setNotice("Printer updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't update that printer.");
    } finally {
      setSavingPrinter_(false);
    }
  }

  async function handleDeletePrinter() {
    if (!detailPrinter) return;
    const count = (recordsByPrinter.get(detailPrinter.id) ?? []).length;
    const warning =
      count > 0
        ? `Delete ${detailPrinter.name} and its ${count} maintenance record${count === 1 ? "" : "s"}? This can't be undone.`
        : `Delete ${detailPrinter.name}? This can't be undone.`;
    if (!window.confirm(warning)) return;
    setSavingPrinter_(true);
    setError("");
    try {
      await deletePrinter(ownerId, detailPrinter.id);
      setDetailPrinterId(null);
      setNotice("Printer deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Couldn't delete that printer.");
    } finally {
      setSavingPrinter_(false);
    }
  }

  function startEditingRecord(record: MaintenanceRecord) {
    setEditingRecordId(record.id);
    setEditRecordDate(record.completedDate);
    setEditRecordNotes(record.notes);
  }

  async function handleSaveRecordEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingRecordId || !editRecordDate || !editRecordNotes.trim()) return;
    setSavingRecordEdit(true);
    setError("");
    try {
      await updateMaintenanceRecord(editingRecordId, { completedDate: editRecordDate, notes: editRecordNotes });
      setEditingRecordId(null);
      setNotice("Maintenance record updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't update that record.");
    } finally {
      setSavingRecordEdit(false);
    }
  }

  async function handleDeleteRecord(record: MaintenanceRecord) {
    if (!window.confirm(`Remove the entry from ${formatMaintenanceDate(record.completedDate)}? This can't be undone.`)) return;
    setError("");
    try {
      await deleteMaintenanceRecord(record.id);
      if (editingRecordId === record.id) setEditingRecordId(null);
      setNotice("Maintenance record removed.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Couldn't remove that record.");
    }
  }

  function startCompleting() {
    setCompleteDate(localDateString());
    setCompleteNotes("");
    setCompleteNextDate("");
    setCompleteError("");
    setCompleting(true);
  }

  async function handleCompleteScheduled(event: FormEvent) {
    event.preventDefault();
    if (!detailPrinter || !completeDate || !completeNotes.trim()) return;
    setSavingComplete(true);
    setCompleteError("");
    setError("");
    try {
      await completeScheduledMaintenance(ownerId, {
        printerId: detailPrinter.id,
        completedDate: completeDate,
        notes: completeNotes,
        nextDueDate: completeNextDate,
      });
      setDetailDueDate(completeNextDate);
      setCompleting(false);
      setNotice(
        completeNextDate
          ? `Maintenance logged and the next one scheduled for ${formatMaintenanceDate(completeNextDate)}.`
          : "Maintenance logged. This printer has no next date set.",
      );
    } catch (saveError) {
      setCompleteError(saveError instanceof Error ? saveError.message : "Couldn't save that maintenance record.");
    } finally {
      setSavingComplete(false);
    }
  }

  async function handleUpdateDetailDueDate(event: FormEvent) {
    event.preventDefault();
    if (!detailPrinter) return;
    setSavingDueDate(true);
    setError("");
    try {
      await updatePrinterNextDueDate(detailPrinter.id, detailDueDate);
      setNotice("Next due date updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't update that date.");
    } finally {
      setSavingDueDate(false);
    }
  }

  async function handleAddPrinter(event: FormEvent) {
    event.preventDefault();
    const model = printerModel === OTHER_PRINTER_MODEL ? customModel.trim() : printerModel;
    if (!printerName.trim() || !model) return;
    setSavingPrinter(true);
    setError("");
    setNotice("");
    try {
      const printerId = await addPrinter(ownerId, { name: printerName, model });
      setPrinterName("");
      setPrinterModel(PRINTER_MODEL_GROUPS[0].models[0]);
      setCustomModel("");
      setSelectedPrinterId(printerId);
      setNotice("Printer added. You can record its first maintenance below.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't add that printer.");
    } finally {
      setSavingPrinter(false);
    }
  }

  async function handleAddMaintenance(event: FormEvent) {
    event.preventDefault();
    if (!maintenancePrinterId || !completedDate || !notes.trim()) return;
    setSavingRecord(true);
    setError("");
    setNotice("");
    try {
      await addMaintenanceRecord(ownerId, {
        printerId: maintenancePrinterId,
        completedDate,
        notes,
      });
      setCompletedDate(localDateString());
      setNotes("");
      setNotice("Maintenance recorded.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't save that maintenance record.");
    } finally {
      setSavingRecord(false);
    }
  }

  async function handleScheduleNext(event: FormEvent) {
    event.preventDefault();
    if (!maintenancePrinterId || !scheduleDate) return;
    setSavingRecord(true);
    setError("");
    setNotice("");
    try {
      await updatePrinterNextDueDate(maintenancePrinterId, scheduleDate);
      setScheduleDate("");
      setNotice("Next maintenance scheduled.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't schedule that date.");
    } finally {
      setSavingRecord(false);
    }
  }

  return (
    <div className="space-y-8">
      {duePrinters.length > 0 &&
        (urgentDuePrinters.length > 0 ? (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-500/40 dark:bg-rose-500/10">
            <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
              Maintenance overdue or due today for {urgentDuePrinters.length} printer
              {urgentDuePrinters.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-xs text-rose-700 dark:text-rose-300">
              {urgentDuePrinters.map((printer) => (
                <li key={printer.id}>{printerDueLabel(printer)}</li>
              ))}
            </ul>
            {duePrinters.length > urgentDuePrinters.length && (
              <div className="mt-3 border-t border-rose-200/70 pt-2 dark:border-rose-500/20">
                <p className="text-xs font-semibold text-rose-700/80 dark:text-rose-300/80">
                  {duePrinters.length - urgentDuePrinters.length} more due within {MAINTENANCE_UPCOMING_WINDOW_DAYS} days
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-rose-700/80 dark:text-rose-300/80">
                  {duePrinters
                    .filter((printer) => !urgentDuePrinters.includes(printer))
                    .map((printer) => (
                      <li key={printer.id}>{printerDueLabel(printer)}</li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-blue-300 bg-blue-50 p-4 dark:border-blue-500/40 dark:bg-blue-500/10">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              Maintenance coming up within {MAINTENANCE_UPCOMING_WINDOW_DAYS} days for {duePrinters.length} printer
              {duePrinters.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
              {duePrinters.map((printer) => (
                <li key={printer.id}>{printerDueLabel(printer)}</li>
              ))}
            </ul>
          </div>
        ))}

      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {notice}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleAddPrinter}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Add a printer</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="printerName" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Custom printer name
              </label>
              <input
                id="printerName"
                required
                value={printerName}
                onChange={(event) => setPrinterName(event.target.value)}
                placeholder="Shop P1S, Garage printer…"
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="printerModel" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Printer model
              </label>
              <select
                id="printerModel"
                value={printerModel}
                onChange={(event) => setPrinterModel(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              >
                {PRINTER_MODEL_GROUPS.map((group) => (
                  <optgroup key={group.brand} label={group.brand}>
                    {group.models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value={OTHER_PRINTER_MODEL}>{OTHER_PRINTER_MODEL}</option>
              </select>
            </div>
            {printerModel === OTHER_PRINTER_MODEL && (
              <div>
                <label htmlFor="customPrinterModel" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Custom model
                </label>
                <input
                  id="customPrinterModel"
                  required
                  autoFocus
                  value={customModel}
                  onChange={(event) => setCustomModel(event.target.value)}
                  placeholder="Manufacturer and model"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={savingPrinter}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600"
            >
              {savingPrinter ? "Adding…" : "Add printer"}
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/[0.06]">
            <button
              type="button"
              onClick={() => setRecordMode("completed")}
              className={`h-9 flex-1 rounded-lg text-xs font-semibold transition-colors ${
                recordMode === "completed"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Record finished maintenance
            </button>
            <button
              type="button"
              onClick={() => setRecordMode("schedule")}
              className={`h-9 flex-1 rounded-lg text-xs font-semibold transition-colors ${
                recordMode === "schedule"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Schedule next maintenance
            </button>
          </div>

          {printers.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
              Add a printer first.
            </p>
          ) : recordMode === "completed" ? (
            <form onSubmit={handleAddMaintenance} className="mt-4 space-y-4">
              <div>
                <label htmlFor="maintenancePrinter" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Printer
                </label>
                <select
                  id="maintenancePrinter"
                  required
                  value={maintenancePrinterId}
                  onChange={(event) => setSelectedPrinterId(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                >
                  {printers.map((printer) => (
                    <option key={printer.id} value={printer.id}>
                      {printer.name} — {printer.model}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="completedDate" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Maintenance completed
                </label>
                <input
                  id="completedDate"
                  type="date"
                  required
                  value={completedDate}
                  onChange={(event) => setCompletedDate(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="maintenanceNotes" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  What was done
                </label>
                <textarea
                  id="maintenanceNotes"
                  required
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Cleaned build plate, lubricated rails, checked belts…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={savingRecord}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingRecord ? "Saving…" : "Save maintenance"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleScheduleNext} className="mt-4 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Just set when this printer is next due — no notes needed, and it won&rsquo;t touch its service history.
              </p>
              <div>
                <label htmlFor="schedulePrinter" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Printer
                </label>
                <select
                  id="schedulePrinter"
                  required
                  value={maintenancePrinterId}
                  onChange={(event) => setSelectedPrinterId(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                >
                  {printers.map((printer) => (
                    <option key={printer.id} value={printer.id}>
                      {printer.name} — {printer.model}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="scheduleDate" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Next maintenance due
                </label>
                <input
                  id="scheduleDate"
                  type="date"
                  required
                  value={scheduleDate}
                  onChange={(event) => setScheduleDate(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={savingRecord}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600"
              >
                {savingRecord ? "Saving…" : "Schedule next maintenance"}
              </button>
            </form>
          )}
        </div>
      </div>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-blue-600 uppercase dark:text-blue-400">Your printers</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
              Maintenance history
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {printers.length} printer{printers.length === 1 ? "" : "s"}
            </span>
            <div className="flex h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-white/[0.03]">
              <button
                type="button"
                onClick={() => setViewMode("block")}
                aria-label="Block view"
                aria-pressed={viewMode === "block"}
                className={`flex h-full items-center rounded-lg px-2.5 transition-colors ${
                  viewMode === "block"
                    ? "bg-slate-950 text-white dark:bg-white/15"
                    : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5"
                }`}
              >
                <GridIcon />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                aria-pressed={viewMode === "list"}
                className={`flex h-full items-center rounded-lg px-2.5 transition-colors ${
                  viewMode === "list"
                    ? "bg-slate-950 text-white dark:bg-white/15"
                    : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5"
                }`}
              >
                <ListViewIcon />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">Loading printers…</p>
        ) : printers.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center dark:border-white/15 dark:bg-white/[0.02]">
            <p className="text-sm text-slate-500 dark:text-slate-400">No printers added yet.</p>
          </div>
        ) : viewMode === "block" ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {printers.map((printer) => {
              const latest = latestByPrinter.get(printer.id);
              const status = maintenanceDueStatus(printer.nextDueDate);
              const history = recordsByPrinter.get(printer.id) ?? [];
              return (
                <article
                  key={printer.id}
                  onDoubleClick={() => setDetailPrinterId(printer.id)}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-400/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold break-words text-slate-950 dark:text-white">{printer.name}</h3>
                      <p className="mt-0.5 text-xs break-words text-slate-500 dark:text-slate-400">{printer.model}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
                      {statusLabel(status, printer.nextDueDate)}
                    </span>
                  </div>

                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    {history.length === 0
                      ? "No maintenance recorded yet."
                      : `Last service ${formatMaintenanceDate(latest?.completedDate ?? "")} · ${history.length} record${history.length === 1 ? "" : "s"}`}
                  </p>

                  <button
                    type="button"
                    onClick={() => setDetailPrinterId(printer.id)}
                    className="mt-3 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View full log →
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
            {printers.map((printer, i) => {
              const latest = latestByPrinter.get(printer.id);
              const status = maintenanceDueStatus(printer.nextDueDate);
              const history = recordsByPrinter.get(printer.id) ?? [];
              return (
                <div
                  key={printer.id}
                  onDoubleClick={() => setDetailPrinterId(printer.id)}
                  className={`flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.05] ${
                    i > 0 ? "border-t border-slate-100 dark:border-white/10" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold break-words text-slate-950 dark:text-white">{printer.name}</p>
                    <p className="mt-0.5 text-xs break-words text-slate-500 dark:text-slate-400">
                      {printer.model} ·{" "}
                      {history.length === 0
                        ? "No service yet"
                        : `Last service ${formatMaintenanceDate(latest?.completedDate ?? "")}`}{" "}
                      · {history.length} record{history.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
                    {statusLabel(status, printer.nextDueDate)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDetailPrinterId(printer.id)}
                    className="shrink-0 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View full log →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {detailPrinter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onClick={() => setDetailPrinterId(null)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#0b1420]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-white/10">
              <div className="flex items-start gap-3 min-w-0">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <WrenchIcon />
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold break-words text-slate-950 dark:text-white">{detailPrinter.name}</h3>
                  <p className="mt-0.5 text-xs break-words text-slate-500 dark:text-slate-400">{detailPrinter.model}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[maintenanceDueStatus(detailPrinter.nextDueDate)]}`}
                    >
                      {statusLabel(maintenanceDueStatus(detailPrinter.nextDueDate), detailPrinter.nextDueDate)}
                    </span>
                    {!editingPrinter && (
                      <button
                        type="button"
                        onClick={startEditingPrinter}
                        className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Edit printer
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailPrinterId(null)}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <XIcon />
              </button>
            </div>

            {editingPrinter && (
              <form
                onSubmit={handleSavePrinterDetails}
                className="space-y-3 border-b border-slate-100 bg-blue-50/40 p-5 dark:border-white/10 dark:bg-blue-500/[0.06]"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="editPrinterName" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Printer name
                    </label>
                    <input
                      id="editPrinterName"
                      required
                      autoFocus
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="editPrinterModel" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Model
                    </label>
                    <select
                      id="editPrinterModel"
                      value={editModel}
                      onChange={(event) => setEditModel(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                    >
                      {PRINTER_MODEL_GROUPS.map((group) => (
                        <optgroup key={group.brand} label={group.brand}>
                          {group.models.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      <option value={OTHER_PRINTER_MODEL}>{OTHER_PRINTER_MODEL}</option>
                    </select>
                  </div>
                </div>
                {editModel === OTHER_PRINTER_MODEL && (
                  <div>
                    <label htmlFor="editCustomModel" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Custom model
                    </label>
                    <input
                      id="editCustomModel"
                      required
                      value={editCustomModel}
                      onChange={(event) => setEditCustomModel(event.target.value)}
                      placeholder="Manufacturer and model"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={savingPrinter_}
                    className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600"
                  >
                    {savingPrinter_ ? "Saving…" : "Save printer"}
                  </button>
                  <button
                    type="button"
                    disabled={savingPrinter_}
                    onClick={() => setEditingPrinter(false)}
                    className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingPrinter_}
                    onClick={handleDeletePrinter}
                    className="ml-auto h-10 rounded-xl border border-rose-200 px-4 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
                  >
                    Delete printer
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-y-auto">
              <section className="border-b border-slate-100 bg-slate-50/60 p-5 dark:border-white/10 dark:bg-white/[0.02]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Scheduled maintenance</p>
                    {detailPrinter.nextDueDate ? (
                      <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                        {formatMaintenanceDate(detailPrinter.nextDueDate)}
                        <span
                          className={`ml-2 inline-flex rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold ${STATUS_STYLES[maintenanceDueStatus(detailPrinter.nextDueDate)]}`}
                        >
                          {maintenanceDueStatus(detailPrinter.nextDueDate) === "overdue"
                            ? "Overdue"
                            : maintenanceDueStatus(detailPrinter.nextDueDate) === "due"
                              ? "Due today"
                              : maintenanceDueStatus(detailPrinter.nextDueDate) === "upcoming"
                                ? "Due soon"
                                : "Scheduled"}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Nothing scheduled. Set a date below.
                      </p>
                    )}
                  </div>
                  {detailPrinter.nextDueDate && !completing && (
                    <button
                      type="button"
                      onClick={startCompleting}
                      className="h-10 shrink-0 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white"
                    >
                      Mark complete
                    </button>
                  )}
                </div>

                {completing && detailPrinter.nextDueDate && (
                  <form
                    onSubmit={handleCompleteScheduled}
                    className="mt-4 space-y-3 rounded-xl border border-blue-200 bg-white p-4 dark:border-blue-400/30 dark:bg-white/[0.03]"
                  >
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Log the work for the job scheduled {formatMaintenanceDate(detailPrinter.nextDueDate)}. It moves to
                      finished maintenance below.
                    </p>
                    <div>
                      <label htmlFor="completeDate" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Completed on
                      </label>
                      <input
                        id="completeDate"
                        type="date"
                        required
                        value={completeDate}
                        onChange={(event) => setCompleteDate(event.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="completeNotes" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        What was done
                      </label>
                      <textarea
                        id="completeNotes"
                        required
                        autoFocus
                        rows={3}
                        value={completeNotes}
                        onChange={(event) => setCompleteNotes(event.target.value)}
                        placeholder="Cleaned build plate, lubricated rails, checked belts…"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="completeNextDate" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Schedule the next one <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <input
                        id="completeNextDate"
                        type="date"
                        value={completeNextDate}
                        onChange={(event) => setCompleteNextDate(event.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                      />
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Leave blank and this printer will have no next date set.
                      </p>
                    </div>
                    {completeError && (
                      <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                        {completeError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={savingComplete}
                        className="h-10 flex-1 rounded-xl bg-blue-600 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingComplete ? "Saving…" : "Save as complete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompleting(false)}
                        disabled={savingComplete}
                        className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {!completing && (
                  <form onSubmit={handleUpdateDetailDueDate} className="mt-4 flex flex-wrap items-end gap-3">
                    <div className="flex-1">
                      <label htmlFor="detailDueDate" className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {detailPrinter.nextDueDate ? "Change next maintenance date" : "Next maintenance due"}
                      </label>
                      <input
                        id="detailDueDate"
                        type="date"
                        value={detailDueDate}
                        onChange={(event) => setDetailDueDate(event.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingDueDate}
                      className="h-11 shrink-0 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600"
                    >
                      {savingDueDate ? "Saving…" : "Save date"}
                    </button>
                  </form>
                )}
              </section>

              <section className="p-5">
                <p className="mb-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Finished maintenance
                  {(recordsByPrinter.get(detailPrinter.id) ?? []).length > 0 &&
                    ` (${(recordsByPrinter.get(detailPrinter.id) ?? []).length})`}
                </p>
                {(recordsByPrinter.get(detailPrinter.id) ?? []).length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                    No maintenance recorded yet.
                  </p>
                ) : (
                  <ol className="space-y-4">
                    {(recordsByPrinter.get(detailPrinter.id) ?? []).map((record) =>
                      editingRecordId === record.id ? (
                        <li key={record.id} className="rounded-xl border border-blue-200 p-3 text-xs dark:border-blue-400/30">
                          <form onSubmit={handleSaveRecordEdit} className="space-y-3">
                            <div>
                              <label htmlFor="editRecordDate" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Completed on
                              </label>
                              <input
                                id="editRecordDate"
                                type="date"
                                required
                                value={editRecordDate}
                                onChange={(event) => setEditRecordDate(event.target.value)}
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                              />
                            </div>
                            <div>
                              <label htmlFor="editRecordNotes" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                What was done
                              </label>
                              <textarea
                                id="editRecordNotes"
                                required
                                autoFocus
                                rows={3}
                                value={editRecordNotes}
                                onChange={(event) => setEditRecordNotes(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={savingRecordEdit}
                                className="h-9 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600"
                              >
                                {savingRecordEdit ? "Saving…" : "Save changes"}
                              </button>
                              <button
                                type="button"
                                disabled={savingRecordEdit}
                                onClick={() => setEditingRecordId(null)}
                                className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </li>
                      ) : (
                        <li key={record.id} className="rounded-xl border border-slate-100 p-3 text-xs dark:border-white/10">
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              Completed {formatMaintenanceDate(record.completedDate)}
                            </span>
                            <span className="flex shrink-0 gap-3">
                              <button
                                type="button"
                                onClick={() => startEditingRecord(record)}
                                className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(record)}
                                className="text-[11px] font-semibold text-rose-600 hover:underline dark:text-rose-400"
                              >
                                Delete
                              </button>
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap leading-5 text-slate-600 dark:text-slate-400">{record.notes}</p>
                        </li>
                      ),
                    )}
                  </ol>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

