"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ListScroll, Pager, usePaged } from "@/components/Pager";
import {
  addMaintenanceRecord,
  addPrinter,
  completeScheduledMaintenance,
  deleteMaintenanceRecord,
  deletePrinter,
  setPrinterOutOfService,
  formatHours,
  formatMaintenanceDate,
  isMaintenanceSoon,
  latestMaintenanceByPrinter,
  localDateString,
  maintenanceDueStatus,
  MAINTENANCE_UPCOMING_WINDOW_DAYS,
  OTHER_PRINTER_MODEL,
  parseHours,
  PRINTER_MODEL_GROUPS,
  subscribeToMaintenanceRecords,
  subscribeToPrinters,
  updateMaintenanceRecord,
  updatePrinterDetails,
  updatePrinterNextDueDate,
  type MaintenanceRecord,
  type Printer,
} from "@/lib/printer-maintenance";
import { WrenchArt } from "@/components/ui/Art";

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

const OUT_OF_SERVICE_STYLE = "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300";

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
  const [printerHours, setPrinterHours] = useState("");
  const [savingPrinter, setSavingPrinter] = useState(false);

  const [recordMode, setRecordMode] = useState<"completed" | "schedule">("completed");
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const [completedDate, setCompletedDate] = useState(() => localDateString());
  const [notes, setNotes] = useState("");
  const [recordHours, setRecordHours] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [savingRecord, setSavingRecord] = useState(false);

  const [viewMode, setViewMode] = useState<"block" | "list">("block");
  const [listFilter, setListFilter] = useState<"active" | "out">("active");
  const [togglingService, setTogglingService] = useState(false);
  const [detailPrinterId, setDetailPrinterId] = useState<string | null>(null);
  const [detailDueDate, setDetailDueDate] = useState("");
  const [savingDueDate, setSavingDueDate] = useState(false);

  // "Mark complete" form for the printer's scheduled job, inside the detail panel.
  const [completing, setCompleting] = useState(false);
  const [completeDate, setCompleteDate] = useState(() => localDateString());
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeNextDate, setCompleteNextDate] = useState("");
  const [completeHours, setCompleteHours] = useState("");
  const [completeError, setCompleteError] = useState("");
  const [savingComplete, setSavingComplete] = useState(false);

  // Rename / re-model / delete the printer from its panel.
  const [editingPrinter, setEditingPrinter] = useState(false);
  const [editName, setEditName] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editCustomModel, setEditCustomModel] = useState("");
  const [editHours, setEditHours] = useState("");
  const [savingPrinter_, setSavingPrinter_] = useState(false);

  // Fix a typo in a finished entry, or remove one logged by mistake.
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editRecordDate, setEditRecordDate] = useState("");
  const [editRecordNotes, setEditRecordNotes] = useState("");
  const [editRecordHours, setEditRecordHours] = useState("");
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
  const maintenancePrinterHours = printers.find((printer) => printer.id === maintenancePrinterId)?.currentHours ?? null;
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
    () => printers.filter((printer) => !printer.outOfService && isMaintenanceSoon(maintenanceDueStatus(printer.nextDueDate))),
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

  const activeCount = printers.filter((printer) => !printer.outOfService).length;
  const outCount = printers.length - activeCount;
  const shownTab = listFilter === "out" && outCount === 0 ? "active" : listFilter;
  const shownPrinters = useMemo(
    () => printers.filter((printer) => (shownTab === "out" ? printer.outOfService : !printer.outOfService)),
    [printers, shownTab],
  );

  // List view only: 10 printers per page inside a scrolling box.
  const pagedPrinters = usePaged(shownPrinters, shownTab, 10);

  async function handleToggleService(printer: Printer) {
    setTogglingService(true);
    setError("");
    try {
      await setPrinterOutOfService(printer.id, !printer.outOfService);
      setNotice(
        printer.outOfService
          ? `${printer.name} is back in service.`
          : `${printer.name} is out of service — it won't raise maintenance reminders until you bring it back.`,
      );
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Couldn't update the printer.");
    } finally {
      setTogglingService(false);
    }
  }

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
    setEditHours(detailPrinter.currentHours === null ? "" : String(detailPrinter.currentHours));
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
      await updatePrinterDetails(detailPrinter.id, { name: editName, model, currentHours: parseHours(editHours) });
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
    setEditRecordHours(record.printerHours === null ? "" : String(record.printerHours));
  }

  async function handleSaveRecordEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingRecordId || !editRecordDate || !editRecordNotes.trim()) return;
    setSavingRecordEdit(true);
    setError("");
    try {
      await updateMaintenanceRecord(editingRecordId, {
        completedDate: editRecordDate,
        notes: editRecordNotes,
        printerHours: parseHours(editRecordHours),
      });
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
    setCompleteHours("");
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
        printerHours: parseHours(completeHours),
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
      const printerId = await addPrinter(ownerId, { name: printerName, model, currentHours: parseHours(printerHours) });
      setPrinterName("");
      setPrinterModel(PRINTER_MODEL_GROUPS[0].models[0]);
      setCustomModel("");
      setPrinterHours("");
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
        printerHours: parseHours(recordHours),
      });
      setCompletedDate(localDateString());
      setNotes("");
      setRecordHours("");
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
          <div className="st-card st-accent st-accent-rose p-4 pl-6">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
              Maintenance overdue or due today for {urgentDuePrinters.length} printer
              {urgentDuePrinters.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
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
          <div className="st-card st-accent st-accent-blue p-4 pl-6">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              Maintenance coming up within {MAINTENANCE_UPCOMING_WINDOW_DAYS} days for {duePrinters.length} printer
              {duePrinters.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
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
          className="st-card p-5"
        >
          <h2 className="st-section-title text-base">Add a printer</h2>
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
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
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
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
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
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
            )}
            <div>
              <label htmlFor="printerHours" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Current print hours <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="printerHours"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={printerHours}
                onChange={(event) => setPrinterHours(event.target.value)}
                placeholder="e.g. 1250"
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Total hours on the printer&rsquo;s counter. Leave blank if you don&rsquo;t track it.
              </p>
            </div>
            <button
              type="submit"
              disabled={savingPrinter}
              className="st-btn-primary h-11 w-full"
            >
              {savingPrinter ? "Adding…" : "Add printer"}
            </button>
          </div>
        </form>

        <div className="st-card p-5">
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
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
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
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="recordHours" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Printer hours at service <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="recordHours"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={recordHours}
                  onChange={(event) => setRecordHours(event.target.value)}
                  placeholder="e.g. 1250"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {maintenancePrinterHours !== null
                    ? `Last recorded: ${formatHours(maintenancePrinterHours)}. Entering a reading here updates the printer.`
                    : "Entering a reading here also sets the printer\u2019s current hours."}
                </p>
              </div>
              <button
                type="submit"
                disabled={savingRecord}
                className="st-btn-primary h-11 w-full"
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
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
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
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-950 focus:border-blue-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={savingRecord}
                className="st-btn-primary h-11 w-full"
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
            <p className="st-eyebrow">Your printers</p>
            <h2 className="st-section-title mt-1 text-2xl">Maintenance history</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {printers.length} printer{printers.length === 1 ? "" : "s"}
            </span>
            <div className="st-segment">
              <button
                type="button"
                onClick={() => setViewMode("block")}
                aria-label="Block view"
                aria-pressed={viewMode === "block"}
                className={`flex h-full items-center rounded-lg px-2.5 transition-colors ${
                  viewMode === "block"
                    ? "st-segment-on"
                    : "st-segment-off"
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
                    ? "st-segment-on"
                    : "st-segment-off"
                }`}
              >
                <ListViewIcon />
              </button>
            </div>
          </div>
        </div>

        {printers.length > 0 && outCount > 0 && (
          <div className="st-segment mt-4 w-fit" role="tablist" aria-label="Printer list">
            {(["active", "out"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={shownTab === tab}
                onClick={() => setListFilter(tab)}
                className={`flex h-full items-center rounded-lg px-3 text-xs font-semibold transition-colors ${
                  shownTab === tab ? "st-segment-on" : "st-segment-off"
                }`}
              >
                {tab === "active" ? `In service (${activeCount})` : `Out of service (${outCount})`}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">Loading printers…</p>
        ) : printers.length === 0 ? (
          <div className="st-empty st-rise mt-5 px-8 py-10">
            <WrenchArt className="mx-auto h-24 w-auto" />
            <p className="mt-3 font-display text-lg font-semibold tracking-[-0.01em] text-slate-950 dark:text-white">No printers added yet.</p>
            <p className="st-lede mt-1">Add one above and its service log starts here.</p>
          </div>
        ) : shownPrinters.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">No printers in service. Open one under &ldquo;Out of service&rdquo; to bring it back.</p>
        ) : viewMode === "block" ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shownPrinters.map((printer) => {
              const latest = latestByPrinter.get(printer.id);
              const status = maintenanceDueStatus(printer.nextDueDate);
              const history = recordsByPrinter.get(printer.id) ?? [];
              return (
                <article
                  key={printer.id}
                  onDoubleClick={() => setDetailPrinterId(printer.id)}
                  className={`st-card st-card-hover cursor-pointer p-5 ${printer.outOfService ? "opacity-70" : ""} ${
                    printer.outOfService ? "" : status === "overdue" ? "st-accent st-accent-rose pl-7" : status === "due" ? "st-accent st-accent-amber pl-7" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg leading-tight font-semibold tracking-[-0.01em] break-words text-slate-950 dark:text-white">{printer.name}</h3>
                      <p className="mt-0.5 text-xs break-words text-slate-500 dark:text-slate-400">{printer.model}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${printer.outOfService ? OUT_OF_SERVICE_STYLE : STATUS_STYLES[status]}`}>
                      {printer.outOfService ? "Out of service" : statusLabel(status, printer.nextDueDate)}
                    </span>
                  </div>

                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    {history.length === 0
                      ? "No maintenance recorded yet."
                      : `Last service ${formatMaintenanceDate(latest?.completedDate ?? "")} · ${history.length} record${history.length === 1 ? "" : "s"}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    Print hours:{" "}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {printer.currentHours !== null ? formatHours(printer.currentHours) : "not entered"}
                    </span>
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
          <div className="mt-5 st-card overflow-hidden">
            <ListScroll page={pagedPrinters.pager.page}>
            {pagedPrinters.pageItems.map((printer, i) => {
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
                      {` · Print hours: ${printer.currentHours !== null ? formatHours(printer.currentHours) : "not entered"}`}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${printer.outOfService ? OUT_OF_SERVICE_STYLE : STATUS_STYLES[status]}`}>
                    {printer.outOfService ? "Out of service" : statusLabel(status, printer.nextDueDate)}
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
            </ListScroll>
            <Pager {...pagedPrinters.pager} noun="printers" className="border-t border-slate-100 px-5 py-3 dark:border-white/10" />
          </div>
        )}
      </section>

      {detailPrinter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={() => setDetailPrinterId(null)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="st-rise flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_40px_80px_-30px_rgba(6,23,37,0.55)] ring-1 ring-slate-900/[0.06] dark:bg-[#0b1420] dark:ring-white/10"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-white/10">
              <div className="flex items-start gap-3 min-w-0">
                <span className="st-badge st-badge-amber mt-0.5">
                  <WrenchIcon />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-xl leading-tight font-semibold tracking-[-0.01em] break-words text-slate-950 dark:text-white">{detailPrinter.name}</h3>
                  <p className="mt-0.5 text-xs break-words text-slate-500 dark:text-slate-400">{detailPrinter.model}
                    {detailPrinter.currentHours !== null ? ` · ${formatHours(detailPrinter.currentHours)} printed` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${detailPrinter.outOfService ? OUT_OF_SERVICE_STYLE : STATUS_STYLES[maintenanceDueStatus(detailPrinter.nextDueDate)]}`}
                    >
                      {detailPrinter.outOfService ? "Out of service" : statusLabel(maintenanceDueStatus(detailPrinter.nextDueDate), detailPrinter.nextDueDate)}
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
                    <button
                      type="button"
                      disabled={togglingService}
                      onClick={() => handleToggleService(detailPrinter)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
                    >
                      {detailPrinter.outOfService ? "Return to service" : "Mark out of service"}
                    </button>
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
                <div>
                  <label htmlFor="editPrinterHours" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Current print hours <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="editPrinterHours"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={editHours}
                    onChange={(event) => setEditHours(event.target.value)}
                    placeholder="e.g. 1250"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={savingPrinter_}
                    className="st-btn-primary h-10 px-4 text-xs"
                  >
                    {savingPrinter_ ? "Saving…" : "Save printer"}
                  </button>
                  <button
                    type="button"
                    disabled={savingPrinter_}
                    onClick={() => setEditingPrinter(false)}
                    className="st-btn-secondary h-10 px-4 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingPrinter_}
                    onClick={handleDeletePrinter}
                    className="st-btn-danger ml-auto h-10 px-4 text-xs"
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
                      className="st-btn-primary h-10 shrink-0 px-4 text-xs"
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
                      <label htmlFor="completeHours" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Printer hours now <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <input
                        id="completeHours"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.1"
                        value={completeHours}
                        onChange={(event) => setCompleteHours(event.target.value)}
                        placeholder="e.g. 1250"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
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
                        className="st-btn-primary h-10 flex-1 text-xs"
                      >
                        {savingComplete ? "Saving…" : "Save as complete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompleting(false)}
                        disabled={savingComplete}
                        className="st-btn-secondary h-10 px-4 text-xs"
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
                      className="st-btn-primary h-11 shrink-0 px-4 text-xs"
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
                            <div>
                              <label htmlFor="editRecordHours" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Printer hours at service <span className="font-normal text-slate-400">(optional)</span>
                              </label>
                              <input
                                id="editRecordHours"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.1"
                                value={editRecordHours}
                                onChange={(event) => setEditRecordHours(event.target.value)}
                                placeholder="e.g. 1250"
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={savingRecordEdit}
                                className="st-btn-primary h-9 px-4 text-xs"
                              >
                                {savingRecordEdit ? "Saving…" : "Save changes"}
                              </button>
                              <button
                                type="button"
                                disabled={savingRecordEdit}
                                onClick={() => setEditingRecordId(null)}
                                className="st-btn-secondary h-9 px-4 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </li>
                      ) : (
                        <li key={record.id} className="st-accent st-accent-emerald rounded-xl py-3 pr-3 pl-5 text-xs shadow-[inset_0_0_0_1px_var(--st-ring)]">
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              Completed {formatMaintenanceDate(record.completedDate)}
                              {record.printerHours !== null && (
                                <span className="font-normal text-slate-500 dark:text-slate-400"> · at {formatHours(record.printerHours)}</span>
                              )}
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

