'use client';

import { useState } from 'react';
import { Database } from 'lucide-react';
import { DairyProvider } from '@/context/DairyContext';
import { TopBar } from '@/components/TopBar';
import { DashboardView } from '@/components/DashboardView';
import { MilkProductionView } from '@/components/MilkProductionView';
import { SalesView } from '@/components/SalesView';
import { CattleView } from '@/components/CattleView';
import { CustomerRevenueView } from '@/components/CustomerRevenueView';
import { ExpensesView } from '@/components/ExpensesView';
import { HealthVaccineView } from '@/components/HealthVaccineView';
import { QuickLogModal } from '@/components/QuickLogModal';
import { DataManagementModal } from '@/components/DataManagementModal';

function DairyAppContent() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [isDataManagementOpen, setIsDataManagementOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans selection:bg-emerald-600 selection:text-white">
      {/* Top Bar in Green and White */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickLogModal={() => setIsQuickLogOpen(true)}
        onOpenDataManagement={() => setIsDataManagementOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigateTab={setActiveTab}
            onOpenMilkModal={() => setActiveTab('production')}
            onOpenCattleModal={() => setActiveTab('cattle')}
            onOpenDataManagement={() => setIsDataManagementOpen(true)}
          />
        )}

        {activeTab === 'production' && <MilkProductionView />}

        {activeTab === 'sales' && <SalesView />}

        {activeTab === 'cattle' && <CattleView />}

        {activeTab === 'customers' && <CustomerRevenueView />}

        {activeTab === 'expenses' && <ExpensesView />}

        {activeTab === 'health' && <HealthVaccineView />}
      </main>

      {/* Footnote */}
      <footer className="border-t border-neutral-200 bg-white py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-800">Verdant Meadow Dairy Farm ERP</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-700 font-semibold">Cold-Chain & HACCP Certified</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-neutral-400">
            <span>Real-Time P&L Tracking</span>
            <span aria-hidden="true">·</span>
            <span>Food-Safe Antibiotic Withholding Enforcement</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setIsDataManagementOpen(true)}
              className="inline-flex items-center gap-1.5 font-semibold text-neutral-500 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              Data &amp; Backup
            </button>
          </div>
        </div>
      </footer>

      {/* Fast Quick Log Floating / Header Modal */}
      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
      />

      <DataManagementModal
        isOpen={isDataManagementOpen}
        onClose={() => setIsDataManagementOpen(false)}
      />
    </div>
  );
}

export function DairyApp() {
  return (
    <DairyProvider>
      <DairyAppContent />
    </DairyProvider>
  );
}
