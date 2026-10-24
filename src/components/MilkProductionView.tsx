'use client';

import React, { useState } from 'react';
import { useDairy } from '../context/DairyContext';
import { MilkLog, MilkingSession } from '../types/dairy';
import { addMonthsISO, endOfMonthISO, lastNDates, parseISODate, startOfMonthISO, todayISO } from '../lib/date';
import { calculateSnf } from '../lib/milk-quality';
import { 
  Milk, 
  Plus, 
  Trash2, 
  Edit3,
  Filter, 
  AlertTriangle, 
  CheckCircle, 
  X,
  Droplets,
  Calendar,
  Layers
} from 'lucide-react';

interface BatchMilkEntry {
  liters: number;
  fat: number;
  clr: number;
  snf: number;
}

interface MilkLogDraft {
  id: string;
  date: string;
  session: MilkingSession;
  cowId: string;
  liters: number;
  fat: number;
  clr: number;
  milkerName: string;
  notes: string;
}

type MilkRangePreset =
  | 'this-month'
  | 'last-month'
  | '3-months'
  | '6-months'
  | '1-year'
  | 'max'
  | 'custom';

export const MilkProductionView: React.FC = () => {
  const { 
    milkLogs, 
    cattle, 
    addMilkLog, 
    updateMilkLog,
    deleteMilkLog, 
    selectedDate, 
    setSelectedDate 
  } = useDairy();

  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [selectedCowFilter, setSelectedCowFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Single log form state
  const [selectedCowId, setSelectedCowId] = useState(cattle[0]?.id || '');
  const [session, setSession] = useState<MilkingSession>('Morning');
  const [liters, setLiters] = useState<number>(12.5);
  const [fatPercentage, setFatPercentage] = useState<number>(4.2);
  const [clr, setClr] = useState<number>(29.4);
  const snfPercentage = calculateSnf(clr, fatPercentage);
  const [milkerName, setMilkerName] = useState('Marcus Evans');
  const [logNotes, setLogNotes] = useState('');
  const [logDate, setLogDate] = useState<string>(selectedDate);

  // Edit-log modal state
  const [editDraft, setEditDraft] = useState<MilkLogDraft | null>(null);
  const editCow = cattle.find((c) => c.id === editDraft?.cowId);
  const isEditCowWithholding = editCow?.healthCondition === 'Withdrawal';
  const editSnf = editDraft ? calculateSnf(editDraft.clr, editDraft.fat) : 0;

  // Selected cow data
  const currentCow = cattle.find((c) => c.id === selectedCowId);
  const isCowWithholding = currentCow?.healthCondition === 'Withdrawal';

  // Batch entry state: one row per lactating cow. SNF is derived from CLR + fat.
  const lactatingCows = cattle.filter((c) => c.status === 'Lactating');
  const [batchData, setBatchData] = useState<{ [cowId: string]: BatchMilkEntry }>({});
  const [batchDate, setBatchDate] = useState<string>(selectedDate);

  // Report date basis. The first two tabs cover calendar months; the dropdown
  // covers longer calendar windows. "Max" uses the full database history.
  const [rangePreset, setRangePreset] = useState<MilkRangePreset>('this-month');
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);

  const today = todayISO();
  const firstLogDate = milkLogs.reduce(
    (earliest, log) => (!earliest || log.date < earliest ? log.date : earliest),
    ''
  );
  const lastLogDate = milkLogs.reduce(
    (latest, log) => (log.date > latest ? log.date : latest),
    ''
  );

  const presetRange =
    rangePreset === 'this-month'
      ? { start: startOfMonthISO(today), end: endOfMonthISO(today) }
      : rangePreset === 'last-month'
      ? {
          start: addMonthsISO(today, -1),
          end: endOfMonthISO(addMonthsISO(today, -1)),
        }
      : rangePreset === '3-months'
      ? { start: addMonthsISO(today, -2), end: endOfMonthISO(today) }
      : rangePreset === '6-months'
      ? { start: addMonthsISO(today, -5), end: endOfMonthISO(today) }
      : rangePreset === '1-year'
      ? { start: addMonthsISO(today, -11), end: endOfMonthISO(today) }
      : rangePreset === 'max'
      ? {
          start: firstLogDate || startOfMonthISO(today),
          end: lastLogDate || endOfMonthISO(today),
        }
      : customRange ?? {
          start: startOfMonthISO(today),
          end: endOfMonthISO(today),
        };

  const rangeStart = presetRange.start;
  const rangeEnd = presetRange.end;
  const rangeDayCount =
    rangeStart && rangeEnd
      ? Math.round(
          (parseISODate(rangeEnd).getTime() - parseISODate(rangeStart).getTime()) / 86400000
        ) + 1
      : 0;

  const rangePresetLabel: Record<MilkRangePreset, string> = {
    'this-month': 'This month',
    'last-month': 'Last month',
    '3-months': '3 months',
    '6-months': '6 months',
    '1-year': '1 year',
    max: 'All time',
    custom: 'Custom range',
  };

  const selectRangePreset = (preset: MilkRangePreset) => {
    setRangePreset(preset);
    if (preset !== 'custom') setCustomRange(null);
    setIsRangePickerOpen(false);
  };

  const updateRangeStart = (start: string) => {
    if (!start) return;
    setRangePreset('custom');
    setCustomRange({ start, end: start > rangeEnd ? start : rangeEnd });
  };

  const updateRangeEnd = (end: string) => {
    if (!end) return;
    setRangePreset('custom');
    setCustomRange({ start: end < rangeStart ? end : rangeStart, end });
  };

  const resetRange = () => {
    selectRangePreset('this-month');
  };

  // Keep a newly saved entry visible: if it falls outside the current range,
  // switch to a 10-day custom window ending on that date.
  const focusSavedDate = (date: string) => {
    setSelectedDate(date);
    if (!date) return;
    if (date < rangeStart || date > rangeEnd) {
      setRangePreset('custom');
      setCustomRange({ start: lastNDates(date, 10)[0] ?? date, end: date });
    }
  };

  const handleOpenBatchModal = () => {
    const initialBatch: { [cowId: string]: BatchMilkEntry } = {};
    lactatingCows.forEach((cow) => {
      // Default to roughly half their daily average yield for a session
      const halfYield = Number((cow.avgDailyYield / 2).toFixed(1));
      const fat = cow.breed === 'Jersey' ? 5.2 : 4.1;
      const clr = 29.4;
      initialBatch[cow.id] = {
        liters: halfYield > 0 ? halfYield : 10,
        fat,
        clr,
        snf: calculateSnf(clr, fat)
      };
    });
    setBatchData(initialBatch);
    // New entries default to the farm date, not the last data point shown.
    setBatchDate(selectedDate || todayISO());
    setIsBatchModalOpen(true);
  };

  const handleSaveBatch = (e: React.FormEvent) => {
    e.preventDefault();
    lactatingCows.forEach((cow) => {
      const data = batchData[cow.id];
      if (data && data.liters > 0) {
        const isWithheld = cow.healthCondition === 'Withdrawal';
        const snf = calculateSnf(Number(data.clr), Number(data.fat));
        addMilkLog({
          date: batchDate,
          session,
          cowId: cow.id,
          cowTag: cow.tagNumber,
          liters: Number(data.liters),
          fatPercentage: Number(data.fat),
          clr: Number(data.clr),
          snfPercentage: snf,
          qualityStatus: isWithheld
            ? 'Discarded'
            : data.fat >= 4.0 && snf >= 8.5
            ? 'Optimal'
            : 'Standard',
          isWithheld,
          milkerName,
          notes: isWithheld ? 'Batch discarded due to antibiotic withholding.' : undefined
        });
      }
    });
    focusSavedDate(batchDate);
    setIsBatchModalOpen(false);
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCow) return;

    const isWithheld = isCowWithholding;
    const quality = isWithheld
      ? 'Discarded'
      : fatPercentage >= 4.0 && snfPercentage >= 8.5
      ? 'Optimal'
      : 'Standard';

    addMilkLog({
      date: logDate,
      session,
      cowId: currentCow.id,
      cowTag: currentCow.tagNumber,
      liters: Number(liters),
      fatPercentage: Number(fatPercentage),
      clr: Number(clr),
      snfPercentage: Number(snfPercentage),
      qualityStatus: quality,
      isWithheld,
      milkerName,
      notes: logNotes || undefined
    });

    focusSavedDate(logDate);
    setIsAddModalOpen(false);
    setLogNotes('');
  };

  const handleOpenEditModal = (log: MilkLog) => {
    // Older rows may not have CLR; infer one from the stored SNF + fat so the
    // first edit does not unexpectedly change the SNF reading.
    const inferredClr =
      typeof log.clr === 'number'
        ? log.clr
        : Number(
            (
              4 *
              (log.snfPercentage - 0.25 * log.fatPercentage - 0.44)
            ).toFixed(1)
          );

    setEditDraft({
      id: log.id,
      date: log.date,
      session: log.session,
      cowId: log.cowId,
      liters: log.liters,
      fat: log.fatPercentage,
      clr: Number.isFinite(inferredClr)
        ? Math.min(40, Math.max(1, inferredClr))
        : 29.4,
      milkerName: log.milkerName,
      notes: log.notes ?? ''
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDraft) return;

    const cow = cattle.find((c) => c.id === editDraft.cowId);
    if (!cow) return;

    const snf = calculateSnf(editDraft.clr, editDraft.fat);
    const isWithheld = cow.healthCondition === 'Withdrawal';

    updateMilkLog(editDraft.id, {
      date: editDraft.date,
      session: editDraft.session,
      cowId: cow.id,
      cowTag: cow.tagNumber,
      liters: Number(editDraft.liters),
      fatPercentage: Number(editDraft.fat),
      clr: Number(editDraft.clr),
      snfPercentage: snf,
      qualityStatus: isWithheld
        ? 'Discarded'
        : editDraft.fat >= 4.0 && snf >= 8.5
        ? 'Optimal'
        : 'Standard',
      isWithheld,
      milkerName: editDraft.milkerName,
      notes: editDraft.notes || undefined
    });

    focusSavedDate(editDraft.date);
    setEditDraft(null);
  };

  // Filtered milk logs
  const filteredLogs = milkLogs
    .filter((m) => {
      const matchesDate = m.date >= rangeStart && m.date <= rangeEnd;
      const matchesSession = sessionFilter === 'all' || m.session === sessionFilter;
      const matchesCow = selectedCowFilter === 'all' || m.cowId === selectedCowFilter;
      return matchesDate && matchesSession && matchesCow;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  // Summary stats for the selected date range
  const rangeTotal = filteredLogs.reduce((acc, m) => acc + m.liters, 0);
  const rangeValid = filteredLogs
    .filter((m) => !m.isWithheld && m.qualityStatus !== 'Discarded')
    .reduce((acc, m) => acc + m.liters, 0);
  const rangeDiscarded = rangeTotal - rangeValid;
  const avgFat = filteredLogs.length > 0
    ? (filteredLogs.reduce((acc, m) => acc + m.fatPercentage, 0) / filteredLogs.length).toFixed(2)
    : '0.00';
  const avgSnf = filteredLogs.length > 0
    ? (filteredLogs.reduce((acc, m) => acc + m.snfPercentage, 0) / filteredLogs.length).toFixed(2)
    : '0.00';
  const clrLogs = filteredLogs.filter((m) => typeof m.clr === 'number');
  const avgClr = clrLogs.length > 0
    ? (clrLogs.reduce((acc, m) => acc + (m.clr as number), 0) / clrLogs.length).toFixed(1)
    : '—';
  const productionDays = new Set(filteredLogs.map((m) => m.date)).size;
  const avgLitersPerDay = productionDays > 0 ? rangeTotal / productionDays : 0;

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
            Milk Production & Milking Sessions
          </h1>
          <p className="text-xs text-stone-500">
            Morning & Evening collection yields, fat, SNF & CLR testing, and bulk chiller intake
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenBatchModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer shadow-xs"
          >
            <Layers className="w-4 h-4 text-emerald-200" />
            <span>Fast Herd Batch Entry</span>
          </button>
          <button
            onClick={() => {
              setLogDate(selectedDate || todayISO());
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>+ Log Single Cow</span>
          </button>
        </div>
      </div>

      {/* Production Metric Highlights for the selected range */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-medium text-neutral-500 block">Total Milk Production</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-neutral-900 tabular-nums">
              {rangeTotal.toFixed(1)}
            </span>
            <span className="text-xs text-neutral-500">Liters</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11px] text-neutral-500">
            <span>
              Avg <strong className="text-emerald-800 tabular-nums">{avgLitersPerDay.toFixed(1)}</strong> L/day
            </span>
            <span className="text-neutral-300">·</span>
            <span>
              {productionDays} production {productionDays === 1 ? 'day' : 'days'}
            </span>
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            {rangeStart} → {rangeEnd} · {filteredLogs.length} logs
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-medium text-neutral-500 block">Usable Tank Intake</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-emerald-800 tabular-nums">
              {rangeValid.toFixed(1)}
            </span>
            <span className="text-xs text-emerald-700">L</span>
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            Approved for supply & cold chain
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-[11px] font-medium text-stone-500 block">Average Quality Metrics</span>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-1">
            <span className="text-sm font-bold text-stone-900 tabular-nums">
              {avgFat}% <span className="text-[10px] font-medium text-stone-500">Fat</span>
            </span>
            <span className="text-stone-300">·</span>
            <span className="text-sm font-bold text-stone-900 tabular-nums">
              {avgSnf}% <span className="text-[10px] font-medium text-stone-500">SNF</span>
            </span>
            <span className="text-stone-300">·</span>
            <span className="text-sm font-bold text-stone-900 tabular-nums">
              {avgClr} <span className="text-[10px] font-medium text-stone-500">CLR</span>
            </span>
          </div>
          <span className="text-[11px] text-stone-400 mt-1 block">
            SNF benchmark ≥ 8.5% · CLR = corrected lactometer reading
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-[11px] font-medium text-stone-500 block">Withheld / Discarded</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={`text-2xl font-bold tabular-nums ${rangeDiscarded > 0 ? 'text-amber-700' : 'text-stone-400'}`}>
              {rangeDiscarded.toFixed(1)}
            </span>
            <span className="text-xs text-stone-500">L</span>
          </div>
          <span className="text-[11px] text-stone-400 mt-1 block">
            {rangeDiscarded > 0 ? 'Safety protocol applied' : 'Zero contaminated milk'}
          </span>
        </div>
      </div>

      {/* Date Range and Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-0.5 bg-stone-100 border border-stone-200 rounded-lg p-0.5">
              <button
                type="button"
                aria-pressed={rangePreset === 'this-month'}
                onClick={() => selectRangePreset('this-month')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                  rangePreset === 'this-month'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                This month
              </button>
              <button
                type="button"
                aria-pressed={rangePreset === 'last-month'}
                onClick={() => selectRangePreset('last-month')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                  rangePreset === 'last-month'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Last month
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-stone-500">Selected base:</label>
              <select
                value={
                  ['3-months', '6-months', '1-year', 'max'].includes(rangePreset)
                    ? rangePreset
                    : ''
                }
                onChange={(e) => {
                  if (e.target.value) {
                    selectRangePreset(e.target.value as MilkRangePreset);
                  }
                }}
                className="text-[11px] font-semibold bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="" disabled>Choose</option>
                <option value="3-months">3 months</option>
                <option value="6-months">6 months</option>
                <option value="1-year">1 year</option>
                <option value="max">Max</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Session filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-stone-500">Session:</label>
              <select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="all">Morning &amp; Evening</option>
                <option value="Morning">Morning AM</option>
                <option value="Evening">Evening PM</option>
              </select>
            </div>

            {/* Cow filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-stone-500">Cow:</label>
              <select
                value={selectedCowFilter}
                onChange={(e) => setSelectedCowFilter(e.target.value)}
                className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="all">All Herd Cattle</option>
                {cattle.map((cow) => (
                  <option key={cow.id} value={cow.id}>
                    {cow.tagNumber} - {cow.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
          <Calendar className="w-4 h-4 text-stone-400" />
          <span className="text-xs font-semibold text-stone-700">
            {rangePresetLabel[rangePreset]}:
          </span>
          <span className="text-xs font-mono font-semibold text-stone-900 bg-stone-50 border border-stone-200 rounded-md px-2 py-1">
            {rangeStart || '—'} → {rangeEnd || '—'}
          </span>
          {rangeDayCount > 0 && (
            <span className="text-[11px] text-stone-400">
              {rangeDayCount} {rangeDayCount === 1 ? 'day' : 'days'}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsRangePickerOpen((open) => !open)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md px-2 py-1 cursor-pointer"
          >
            <Calendar className="w-3 h-3" />
            {isRangePickerOpen ? 'Hide dates' : 'Choose dates'}
          </button>
          {rangePreset !== 'this-month' && (
            <button
              type="button"
              onClick={resetRange}
              className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 underline underline-offset-2 cursor-pointer"
            >
              Reset to this month
            </button>
          )}
        </div>

        {isRangePickerOpen && (
          <div className="flex flex-wrap items-end gap-3 border-t border-stone-100 pt-3">
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">From</label>
              <input
                type="date"
                value={rangeStart}
                max={rangeEnd || undefined}
                onChange={(e) => updateRangeStart(e.target.value)}
                className="text-xs font-medium bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">To</label>
              <input
                type="date"
                value={rangeEnd}
                min={rangeStart || undefined}
                onChange={(e) => updateRangeEnd(e.target.value)}
                className="text-xs font-medium bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsRangePickerOpen(false)}
              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
            >
              Done
            </button>
            <span className="text-[11px] text-stone-400 pb-1.5">
              Showing {rangeDayCount} {rangeDayCount === 1 ? 'day' : 'days'} of records
            </span>
          </div>
        )}
      </div>

      {/* Production Log Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Milking Session</th>
                <th className="py-3 px-4">Cattle Tag & Name</th>
                <th className="py-3 px-4 text-right">Yield (Liters)</th>
                <th className="py-3 px-4 text-right">Fat %</th>
                <th className="py-3 px-4 text-right" title="Corrected Lactometer Reading">CLR</th>
                <th className="py-3 px-4 text-right">SNF %</th>
                <th className="py-3 px-4">Quality Status</th>
                <th className="py-3 px-4">Milker</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {filteredLogs.map((log) => {
                const cow = cattle.find((c) => c.id === log.cowId);
                const isDiscarded = log.isWithheld || log.qualityStatus === 'Discarded';

                return (
                  <tr key={log.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-stone-600 whitespace-nowrap">
                      {log.date}
                    </td>

                    <td className="py-3 px-4 font-semibold text-stone-900">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${log.session === 'Morning' ? 'bg-amber-500' : 'bg-indigo-500'}`} />
                        <span>{log.session}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-stone-800 bg-stone-100 px-1.5 py-0.5 rounded text-[11px]">
                          {log.cowTag}
                        </span>
                        <span className="font-medium text-stone-800">{cow?.name || 'Cattle'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-stone-900 tabular-nums">
                      {log.liters.toFixed(1)} L
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-600">
                      {log.fatPercentage.toFixed(2)}%
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-600">
                      {typeof log.clr === 'number' ? log.clr.toFixed(1) : '—'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-600">
                      {log.snfPercentage.toFixed(2)}%
                    </td>

                    <td className="py-3 px-4">
                      {isDiscarded ? (
                        <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-bold text-[11px] border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Discarded / Withheld
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold text-[11px]">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          {log.qualityStatus}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-stone-600">
                      {log.milkerName}
                    </td>

                    <td className="py-3 px-4 text-stone-500 max-w-[200px] truncate" title={log.notes}>
                      {log.notes || '—'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(log)}
                          className="p-1.5 text-stone-400 hover:text-emerald-700 rounded cursor-pointer"
                          title="Edit log"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                'Permanently delete this milk log entry? This cannot be undone.'
                              )
                            ) {
                              deleteMilkLog(log.id);
                            }
                          }}
                          className="p-1.5 text-stone-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Delete log"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="py-12 text-center text-stone-500">
            <p className="text-sm font-semibold">
              No milking logs found between {rangeStart} and {rangeEnd}
            </p>
            <p className="text-xs text-stone-400 mt-1">
              Choose a different date range, or click &quot;+ Log Single Cow&quot; / &quot;Fast Herd Batch Entry&quot; to record milk yields.
            </p>
          </div>
        )}
      </div>

      {/* Single Cow Log Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-stone-200">
            <form onSubmit={handleSingleSubmit}>
              <div className="p-5 border-b border-stone-200 flex items-center justify-between">
                <h3 className="text-base font-bold text-stone-900">Record Milking Yield</h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                {/* Cow Selector */}
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Select Cattle *</label>
                  <select
                    value={selectedCowId}
                    onChange={(e) => setSelectedCowId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-hidden focus:border-emerald-600"
                  >
                    {cattle.map((cow) => (
                      <option key={cow.id} value={cow.id}>
                        {cow.tagNumber} - {cow.name} ({cow.breed}, {cow.status})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Withholding Warning if active */}
                {isCowWithholding && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      <span>Antibiotic Withholding Active!</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      This cow is receiving medical treatment. This milk will be logged for health tracking but marked as <strong>Discarded</strong> and withheld from human distribution.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Milking Date *</label>
                    <input
                      type="date"
                      required
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Session</label>
                    <select
                      value={session}
                      onChange={(e) => setSession(e.target.value as MilkingSession)}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white"
                    >
                      <option value="Morning">Morning AM</option>
                      <option value="Evening">Evening PM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Yield (Liters) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={liters}
                    onChange={(e) => setLiters(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">CLR</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="40"
                      value={clr}
                      onChange={(e) => setClr(Number(e.target.value))}
                      title="Corrected Lactometer Reading"
                      className="w-full px-2 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Butterfat %</label>
                    <input
                      type="number"
                      step="0.05"
                      min="1.0"
                      max="10.0"
                      value={fatPercentage}
                      onChange={(e) => setFatPercentage(Number(e.target.value))}
                      className="w-full px-2 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">SNF % (auto)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={snfPercentage}
                      readOnly
                      tabIndex={-1}
                      title="Calculated from CLR and butterfat"
                      className="w-full px-2 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-600 cursor-default"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-stone-500">
                  SNF is calculated automatically: CLR ÷ 4 + 0.25 × fat + 0.44.
                </p>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Milker / Tech Name</label>
                  <input
                    type="text"
                    value={milkerName}
                    onChange={(e) => setMilkerName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Session Notes (Optional)</label>
                  <input
                    type="text"
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    placeholder="e.g. fast flow, slight mastitis check"
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs"
                >
                  Save Milk Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Milk Log Modal */}
      {editDraft && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-stone-200">
            <form onSubmit={handleEditSubmit}>
              <div className="p-5 border-b border-stone-200 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-stone-900">Edit Milk Log</h3>
                  <p className="text-[11px] text-stone-500">
                    Update this daily milking record and save it to the database.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditDraft(null)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Select Cattle *</label>
                  <select
                    value={editDraft.cowId}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, cowId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-hidden focus:border-emerald-600"
                  >
                    {cattle.map((cow) => (
                      <option key={cow.id} value={cow.id}>
                        {cow.tagNumber} - {cow.name} ({cow.breed}, {cow.status})
                      </option>
                    ))}
                  </select>
                </div>

                {isEditCowWithholding && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      <span>Antibiotic Withholding Active!</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      This cow is receiving medical treatment. The edited milk will remain marked as{' '}
                      <strong>Discarded</strong> and withheld from human distribution.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Milking Date *</label>
                    <input
                      type="date"
                      required
                      value={editDraft.date}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, date: e.target.value })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Session</label>
                    <select
                      value={editDraft.session}
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft,
                          session: e.target.value as MilkingSession
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white"
                    >
                      <option value="Morning">Morning AM</option>
                      <option value="Evening">Evening PM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Yield (Liters) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={editDraft.liters}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, liters: Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">CLR</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="40"
                      value={editDraft.clr}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, clr: Number(e.target.value) })
                      }
                      title="Corrected Lactometer Reading"
                      className="w-full px-2 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Butterfat %</label>
                    <input
                      type="number"
                      step="0.05"
                      min="1.0"
                      max="10.0"
                      value={editDraft.fat}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, fat: Number(e.target.value) })
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">SNF % (auto)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editSnf}
                      readOnly
                      tabIndex={-1}
                      title="Calculated from CLR and butterfat"
                      className="w-full px-2 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-600 cursor-default"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-stone-500">
                  SNF is calculated automatically: CLR ÷ 4 + 0.25 × fat + 0.44.
                </p>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Milker / Tech Name</label>
                  <input
                    type="text"
                    value={editDraft.milkerName}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, milkerName: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Session Notes (Optional)</label>
                  <input
                    type="text"
                    value={editDraft.notes}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, notes: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditDraft(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Herd Batch Entry Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-stone-200">
            <form onSubmit={handleSaveBatch}>
              <div className="p-5 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <h3 className="text-base font-bold text-stone-900">Herd Fast-Batch Milking Entry</h3>
                  <p className="text-xs text-stone-500">Record session yields for all lactating cows simultaneously</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="flex flex-wrap items-center gap-4 bg-stone-50 p-3 rounded-lg border border-stone-200">
                  <div>
                    <label className="block text-stone-600 font-semibold mb-1">Session Target:</label>
                    <select
                      value={session}
                      onChange={(e) => setSession(e.target.value as MilkingSession)}
                      className="px-2.5 py-1 text-xs border border-stone-300 rounded bg-white"
                    >
                      <option value="Morning">Morning AM</option>
                      <option value="Evening">Evening PM</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-stone-600 font-semibold mb-1">Milking Date:</label>
                    <input
                      type="date"
                      required
                      value={batchDate}
                      onChange={(e) => setBatchDate(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-stone-300 rounded bg-white text-stone-800 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-600 font-semibold mb-1">Milker:</label>
                    <input
                      type="text"
                      value={milkerName}
                      onChange={(e) => setMilkerName(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-stone-300 rounded bg-white"
                    />
                  </div>
                </div>

                <div className="border border-stone-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-100 border-b border-stone-200 font-semibold text-stone-600">
                      <tr>
                        <th className="p-2.5">Tag & Cow Name</th>
                        <th className="p-2.5">Breed / Status</th>
                        <th className="p-2.5 w-28">Yield (L)</th>
                        <th className="p-2.5 w-20" title="Corrected Lactometer Reading">CLR</th>
                        <th className="p-2.5 w-24">Fat %</th>
                        <th className="p-2.5 w-24">SNF %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {lactatingCows.map((cow) => {
                        const isWithheld = cow.healthCondition === 'Withdrawal';
                        const current = batchData[cow.id] || {
                          liters: 0,
                          fat: 4.1,
                          clr: 29.4,
                          snf: calculateSnf(29.4, 4.1)
                        };

                        return (
                          <tr key={cow.id} className={isWithheld ? 'bg-amber-50/50' : ''}>
                            <td className="p-2.5 font-medium text-stone-900">
                              <span className="font-mono font-bold mr-1.5">{cow.tagNumber}</span>
                              <span>{cow.name}</span>
                            </td>
                            <td className="p-2.5 text-stone-500">
                              {cow.breed}
                              {isWithheld && (
                                <span className="ml-2 text-[10px] text-amber-800 bg-amber-100 px-1 rounded font-bold">
                                  WITHHOLDING ACTIVE
                                </span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={current.liters}
                                onChange={(e) =>
                                  setBatchData({
                                    ...batchData,
                                    [cow.id]: { ...current, liters: Number(e.target.value) }
                                  })
                                }
                                className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-xs"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                step="0.1"
                                min="1"
                                max="40"
                                value={current.clr}
                                onChange={(e) => {
                                  const clr = Number(e.target.value);
                                  setBatchData({
                                    ...batchData,
                                    [cow.id]: {
                                      ...current,
                                      clr,
                                      snf: calculateSnf(clr, current.fat)
                                    }
                                  });
                                }}
                                title="Corrected Lactometer Reading"
                                className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-xs"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                step="0.1"
                                min="1.0"
                                max="10.0"
                                value={current.fat}
                                onChange={(e) => {
                                  const fat = Number(e.target.value);
                                  setBatchData({
                                    ...batchData,
                                    [cow.id]: {
                                      ...current,
                                      fat,
                                      snf: calculateSnf(current.clr, fat)
                                    }
                                  });
                                }}
                                className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-xs"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                step="0.01"
                                value={current.snf}
                                readOnly
                                tabIndex={-1}
                                title="Calculated from CLR and butterfat"
                                className="w-full px-2 py-1 border border-stone-200 rounded font-mono text-xs bg-stone-50 text-stone-600 cursor-default"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="text-[10px] text-stone-500">
                  SNF is calculated automatically from CLR and fat: CLR ÷ 4 + 0.25 × fat + 0.44.
                </p>
              </div>

              <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs"
                >
                  Submit Batch Milking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
