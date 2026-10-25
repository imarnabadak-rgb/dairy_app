'use client';

import React from 'react';
import { useDairy } from '../context/DairyContext';
import { 
  Calendar, 
  Database,
  Download, 
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface TopBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenQuickLogModal: () => void;
  onOpenDataManagement: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  onOpenQuickLogModal,
  onOpenDataManagement,
}) => {
  const { 
    selectedDate, 
    setSelectedDate, 
    exportDataJSON, 
    cattle,
    syncStatus,
    lastSyncedAt,
    databaseError,
    refreshFromDatabase,
  } = useDairy();

  const withdrawalCount = cattle.filter(
    (c) => c.healthCondition === 'Withdrawal'
  ).length;

  const syncMeta = {
    loading: {
      label: 'Connecting',
      dot: 'bg-sky-500',
      tone: 'bg-sky-50 text-sky-800 border-sky-200',
      title: 'Loading farm data from the database…',
    },
    saving: {
      label: 'Saving…',
      dot: 'bg-sky-500',
      tone: 'bg-sky-50 text-sky-800 border-sky-200',
      title: 'Writing changes to Supabase…',
    },
    database: {
      label: 'Database',
      dot: 'bg-emerald-500',
      tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      title: lastSyncedAt
        ? `Supabase connected. Last sync ${new Date(lastSyncedAt).toLocaleTimeString()}.`
        : 'Connected to Supabase.',
    },
    error: {
      label: 'DB error',
      dot: 'bg-rose-500',
      tone: 'bg-rose-50 text-rose-800 border-rose-200',
      title: databaseError ?? 'Could not reach Supabase.',
    },
  }[syncStatus];

  const navLinks = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'production', label: 'Milk Yield' },
    { id: 'sales', label: 'Sales' },
    { id: 'cattle', label: 'Cattle Herd' },
    { id: 'customers', label: 'Revenue & Customers' },
    { id: 'expenses', label: 'Farm Expenses' },
    { id: 'health', label: 'Vaccines & Care' },
  ];

  return (
    <header className="border-b border-neutral-200 bg-white sticky top-0 z-30 shadow-xs">
      {/* 3-zone Top Bar in Pure Emerald Green & White */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('dashboard');
            }}
            className="text-lg font-extrabold tracking-tight text-neutral-900 flex items-center gap-2 group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-black text-base shadow-xs group-hover:bg-emerald-800 transition-colors border border-emerald-800">
              DF
            </div>
            <div className="flex items-center gap-1.5">
              <span>DairyFlow</span>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                ERP
              </span>
            </div>
          </a>
        </div>

        {/* Zone 2: Clean text navigation links in green and white */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5">
          {navLinks.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs border border-emerald-800'
                    : 'text-neutral-600 hover:text-emerald-950 hover:bg-emerald-50'
                }`}
              >
                <span>{tab.label}</span>
                {tab.id === 'expenses' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
                {tab.id === 'health' && withdrawalCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Active milk withdrawal alert" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions & date controller */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Database status / refresh */}
          <button
            type="button"
            onClick={() => void refreshFromDatabase()}
            disabled={syncStatus === 'loading' || syncStatus === 'saving'}
            title={`${syncMeta.title} Click to refresh.`}
            className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer disabled:cursor-wait ${syncMeta.tone}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${syncMeta.dot}`} />
            <span>{syncMeta.label}</span>
            <RefreshCw
              className={`w-3 h-3 ${syncStatus === 'loading' || syncStatus === 'saving' ? 'animate-spin' : ''}`}
            />
          </button>

          {/* Farm Date Selector */}
          <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-700">
            <Calendar className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-neutral-800 focus:outline-hidden cursor-pointer"
              title="Change active farm log date"
            />
          </div>

          {/* Quick Log Action */}
          <button
            onClick={onOpenQuickLogModal}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shadow-xs cursor-pointer border border-emerald-800"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+ Quick Log</span>
          </button>

          {/* Data, Import & Backup */}
          <button
            onClick={onOpenDataManagement}
            title="Import CSV, back up, or reset farm data"
            aria-label="Open data management"
            className="p-1.5 text-neutral-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg border border-neutral-200 transition-colors cursor-pointer"
          >
            <Database className="w-4 h-4" />
          </button>

          {/* Backup / Export */}
          <button
            onClick={exportDataJSON}
            title="Export JSON Farm Backup"
            className="p-1.5 text-neutral-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg border border-neutral-200 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation bar with responsive scroll */}
      <div className="lg:hidden border-t border-neutral-200 px-3 py-2 bg-neutral-50 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
        {navLinks.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap transition-colors flex items-center gap-1 ${
                isActive
                  ? 'bg-emerald-700 text-white border border-emerald-800'
                  : 'text-neutral-600 bg-white border border-neutral-200'
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === 'health' && withdrawalCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
