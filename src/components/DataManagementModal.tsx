'use client';

import React, { useEffect, useState } from 'react';
import { useDairy } from '../context/DairyContext';
import type {
  CsvImportPreview,
  CsvImportResult,
} from '../lib/csv-import';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    exportDataJSON,
    previewCsvImport,
    importCsv,
    clearFarmData,
    syncStatus,
  } = useDairy();
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importCsvText, setImportCsvText] = useState('');
  const [importPreview, setImportPreview] =
    useState<CsvImportPreview | null>(null);
  const [importResult, setImportResult] =
    useState<CsvImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsConfirmingClear(false);
      setImportFileName('');
      setImportCsvText('');
      setImportPreview(null);
      setImportResult(null);
      setImportError(null);
      setIsImporting(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isImporting) onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImporting, isOpen, onClose]);

  if (!isOpen) return null;

  const handleClearFarmData = () => {
    clearFarmData();
    setIsConfirmingClear(false);
    onClose();
  };

  const handleCsvFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setImportFileName(file.name);
    setImportCsvText('');
    setImportPreview(null);
    setImportResult(null);
    setImportError(null);

    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setImportError('Choose a .csv file.');
      return;
    }

    try {
      const text = await file.text();
      if (!text.trim()) {
        setImportError('The selected CSV file is empty.');
        return;
      }

      const preview = previewCsvImport(text, file.name);
      setImportCsvText(text);
      setImportPreview(preview);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : 'Could not read the CSV file.'
      );
    }
  };

  const handleImportCsv = async (): Promise<void> => {
    if (!importCsvText || !importPreview) return;

    setIsImporting(true);
    setImportError(null);

    try {
      const result = await importCsv(importCsvText, importFileName);
      setImportResult(result);
      setImportCsvText('');
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : 'Could not import the CSV file.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  const isDatabaseBusy =
    syncStatus === 'loading' || syncStatus === 'saving';
  const isDatabaseUnavailable = syncStatus === 'error';

  const countItems: Array<[string, number]> = importPreview
    ? ([
        ['Cattle', importPreview.counts.cattle],
        ['Milk logs', importPreview.counts.milkLogs],
        ['Customers', importPreview.counts.customers],
        ['Sales', importPreview.counts.sales],
        ['Sales updated', importPreview.counts.updatedSales],
        ['Expenses', importPreview.counts.expenses],
        ['Vaccines', importPreview.counts.vaccines],
        ['Payment invoices', importPreview.counts.invoices],
      ] as Array<[string, number]>).filter(([, count]) => count > 0)
    : [];

  const totalNewRecords = importPreview
    ? importPreview.counts.cattle +
      importPreview.counts.milkLogs +
      importPreview.counts.customers +
      importPreview.counts.sales +
      importPreview.counts.expenses +
      importPreview.counts.vaccines +
      importPreview.counts.invoices
    : 0;
  const hasImportChanges =
    totalNewRecords > 0 || (importPreview?.counts.updatedSales ?? 0) > 0;
  const canImport =
    Boolean(importCsvText) &&
    Boolean(importPreview) &&
    importPreview!.errors.length === 0 &&
    hasImportChanges &&
    !isImporting &&
    !isDatabaseBusy &&
    !isDatabaseUnavailable;

  return (
    <div
      className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => {
        if (!isImporting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-management-title"
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-neutral-200 overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-5 border-b border-neutral-200 flex items-start justify-between gap-4">
          <div>
            <h3
              id="data-management-title"
              className="text-base font-bold text-neutral-900"
            >
              Data Management
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Import old farm records, back up current data, or reset this
              farm.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            aria-label="Close data management"
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs overflow-y-auto">
          <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-neutral-900">
              <Upload className="w-4 h-4 text-emerald-700" />
              <h4 className="font-bold">Import Old Farm CSV</h4>
            </div>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Upload a Dairy Farm Report CSV. The importer reads MILK, COWS,
              HEALTH, SALES, EXPENSES, PAYMENTS RECEIVED, and BUYERS sections.
              Existing records are skipped by tag, buyer, date, or matching
              values.
            </p>

            <label
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 bg-white text-emerald-800 font-semibold transition-colors ${
                isImporting
                  ? 'cursor-wait opacity-60'
                  : 'cursor-pointer hover:bg-emerald-100'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              {importFileName ? 'Choose a different CSV' : 'Choose CSV file'}
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFile}
                disabled={isImporting}
                className="sr-only"
              />
            </label>

            {importFileName && !importPreview && !importError && (
              <p className="text-[11px] text-neutral-500">
                Reading {importFileName}...
              </p>
            )}

            {importError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {importPreview && (
              <div className="rounded-lg border border-emerald-200 bg-white p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900 break-all">
                      {importPreview.fileName}
                    </p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">
                      {importPreview.sections.join(' · ')}
                      {importPreview.range
                        ? ` · ${importPreview.range.from} to ${importPreview.range.to}`
                        : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      importPreview.errors.length > 0
                        ? 'bg-rose-100 text-rose-800'
                        : hasImportChanges
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {importPreview.errors.length > 0
                      ? 'Cannot import'
                      : hasImportChanges
                      ? 'Ready'
                      : 'No new rows'}
                  </span>
                </div>

                {countItems.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {countItems.map(([label, count]) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] font-semibold text-neutral-700"
                      >
                        {label}
                        <span className="rounded bg-white px-1.5 py-0.5 text-emerald-800">
                          {count}
                        </span>
                      </span>
                    ))}
                    {importPreview.counts.skipped > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
                        Skipped
                        <span className="rounded bg-white px-1.5 py-0.5">
                          {importPreview.counts.skipped}
                        </span>
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-500">
                    No new records found. This file is already imported or all
                    rows were skipped.
                  </p>
                )}

                {importPreview.errors.length > 0 && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-[10px] text-rose-800 space-y-1">
                    {importPreview.errors.map((error) => (
                      <p key={error}>{error}</p>
                    ))}
                  </div>
                )}

                {importPreview.warnings.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[10px] text-amber-900 space-y-1">
                    <p className="font-bold">Import notes</p>
                    {importPreview.warnings.slice(0, 5).map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                    {importPreview.warnings.length > 5 && (
                      <p>
                        And {importPreview.warnings.length - 5} more warning
                        {importPreview.warnings.length - 5 === 1 ? '' : 's'}.
                      </p>
                    )}
                  </div>
                )}

                {importResult ? (
                  <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Import complete
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      {importResult.inserted} new record
                      {importResult.inserted === 1 ? '' : 's'} saved.
                      {importResult.counts.updatedSales > 0
                        ? ` ${importResult.counts.updatedSales} existing sale${
                            importResult.counts.updatedSales === 1 ? '' : 's'
                          } updated.`
                        : ''}
                      {importResult.skipped > 0
                        ? ` ${importResult.skipped} row${
                            importResult.skipped === 1 ? '' : 's'
                          } skipped.`
                        : ''}
                    </p>
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 transition-colors cursor-pointer"
                    >
                      View imported data
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleImportCsv}
                      disabled={!canImport}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isImporting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      {isImporting ? 'Importing...' : 'Import CSV data'}
                    </button>
                    {!hasImportChanges && (
                      <p className="text-[10px] text-neutral-500">
                        Nothing new to import.
                      </p>
                    )}
                    {isDatabaseBusy && (
                      <p className="text-[10px] font-semibold text-amber-700">
                        Please wait for the current database{' '}
                        {syncStatus === 'loading' ? 'load' : 'save'} to finish.
                      </p>
                    )}
                    {isDatabaseUnavailable && (
                      <p className="text-[10px] font-semibold text-rose-700">
                        The database is not connected. CSV import is disabled
                        until it is available.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-neutral-200 p-4 space-y-2">
            <div className="flex items-center gap-2 text-neutral-900">
              <Download className="w-4 h-4 text-emerald-700" />
              <h4 className="font-bold">Backup</h4>
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Download a JSON copy of all current farm records before clearing
              or making major changes.
            </p>
            <button
              type="button"
              onClick={exportDataJSON}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON Backup
            </button>
          </section>

          <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-rose-950">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h4 className="font-bold">Danger Zone</h4>
            </div>
            <p className="text-[11px] text-rose-800 leading-relaxed">
              Clearing farm data permanently removes all cattle, milk logs,
              sales, customers, supply records, invoices, vaccines, tanks,
              feed stock, and expenses from the database.
            </p>

            {isConfirmingClear ? (
              <div className="rounded-lg border border-rose-300 bg-white p-3 space-y-3">
                <p className="text-[11px] font-semibold text-rose-900">
                  Are you sure? This cannot be undone.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClear(false)}
                    className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-neutral-700 font-semibold hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFarmData}
                    disabled={isDatabaseBusy || isDatabaseUnavailable}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 text-white font-semibold hover:bg-rose-800 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-70"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Yes, clear everything
                  </button>
                </div>
                {isDatabaseBusy && (
                  <p className="text-[10px] font-semibold text-rose-700">
                    Please wait for the current database{' '}
                    {syncStatus === 'loading' ? 'load' : 'save'} to finish before
                    clearing.
                  </p>
                )}
                {isDatabaseUnavailable && (
                  <p className="text-[10px] font-semibold text-rose-700">
                    The database is not connected, so farm data cannot be cleared
                    right now.
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingClear(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-700 text-white font-semibold hover:bg-rose-800 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All Farm Data
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
