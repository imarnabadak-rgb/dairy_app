'use client';

import React, { useEffect, useState } from 'react';
import { useDairy } from '../context/DairyContext';
import {
  AlertTriangle,
  Download,
  Trash2,
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
  const { exportDataJSON, clearFarmData, syncStatus } = useDairy();
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsConfirmingClear(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClearFarmData = () => {
    clearFarmData();
    setIsConfirmingClear(false);
    onClose();
  };

  const isDatabaseBusy =
    syncStatus === 'loading' || syncStatus === 'saving';
  const isDatabaseUnavailable = syncStatus === 'error';

  return (
    <div
      className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-management-title"
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-neutral-200 overflow-hidden"
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
              Backup or reset this farm&apos;s records.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close data management"
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
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
