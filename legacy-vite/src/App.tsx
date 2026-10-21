/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DairyProvider } from './context/DairyContext';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { MilkProductionView } from './components/MilkProductionView';
import { CattleView } from './components/CattleView';
import { SupplyDeliveryView } from './components/SupplyDeliveryView';
import { CustomerRevenueView } from './components/CustomerRevenueView';
import { ExpensesView } from './components/ExpensesView';
import { AiAdvisorView } from './components/AiAdvisorView';
import { HealthVaccineView } from './components/HealthVaccineView';
import { FeedTanksView } from './components/FeedTanksView';
import { QuickLogModal } from './components/QuickLogModal';

function DairyAppContent() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans selection:bg-emerald-600 selection:text-white">
      {/* Top Bar in Green and White */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickLogModal={() => setIsQuickLogOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigateTab={setActiveTab}
            onOpenMilkModal={() => setActiveTab('production')}
            onOpenSupplyModal={() => setActiveTab('supply')}
            onOpenCattleModal={() => setActiveTab('cattle')}
          />
        )}

        {activeTab === 'production' && <MilkProductionView />}

        {activeTab === 'cattle' && <CattleView onNavigateToAi={() => setActiveTab('ai')} />}

        {activeTab === 'ai' && <AiAdvisorView />}

        {activeTab === 'supply' && <SupplyDeliveryView />}

        {activeTab === 'customers' && <CustomerRevenueView />}

        {activeTab === 'expenses' && <ExpensesView />}

        {activeTab === 'health' && <HealthVaccineView />}

        {activeTab === 'inventory' && <FeedTanksView />}
      </main>

      {/* Footnote */}
      <footer className="border-t border-neutral-200 bg-white py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-800">Verdant Meadow Dairy Farm ERP</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-700 font-semibold">Cold-Chain & HACCP Certified</span>
          </div>
          <div className="flex items-center gap-4 text-neutral-400">
            <span>Real-Time P&L Tracking</span>
            <span aria-hidden="true">·</span>
            <span>Food-Safe Antibiotic Withholding Enforcement</span>
          </div>
        </div>
      </footer>

      {/* Fast Quick Log Floating / Header Modal */}
      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <DairyProvider>
      <DairyAppContent />
    </DairyProvider>
  );
}
