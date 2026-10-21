'use client';

import React, { useState } from 'react';
import { useDairy } from '../context/DairyContext';
import { MilkingSession } from '../types/dairy';
import { Milk, Truck, HeartPulse, X, AlertTriangle } from 'lucide-react';

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickLogModal: React.FC<QuickLogModalProps> = ({ isOpen, onClose }) => {
  const { cattle, customers, selectedDate, addMilkLog, addSupplyLog } = useDairy();

  const [activeTab, setActiveTab] = useState<'milk' | 'delivery'>('milk');

  // Milk quick form
  const [selectedCowId, setSelectedCowId] = useState(cattle[0]?.id || '');
  const [session, setSession] = useState<MilkingSession>('Morning');
  const [liters, setLiters] = useState<number>(14.0);
  const [fat, setFat] = useState<number>(4.2);
  const [snf, setSnf] = useState<number>(8.8);

  // Delivery quick form
  const [selectedCustId, setSelectedCustId] = useState(customers[0]?.id || '');
  const [deliveryLiters, setDeliveryLiters] = useState<number>(3.0);

  if (!isOpen) return null;

  const currentCow = cattle.find((c) => c.id === selectedCowId);
  const isWithheld = currentCow?.healthCondition === 'Withdrawal';

  const handleMilkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCow) return;

    addMilkLog({
      date: selectedDate,
      session,
      cowId: currentCow.id,
      cowTag: currentCow.tagNumber,
      liters: Number(liters),
      fatPercentage: Number(fat),
      snfPercentage: Number(snf),
      qualityStatus: isWithheld ? 'Discarded' : 'Optimal',
      isWithheld: isWithheld,
      milkerName: 'Station Operator',
      notes: isWithheld ? 'Quick log withheld' : undefined
    });
    onClose();
  };

  const handleDeliverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === selectedCustId);
    if (!cust) return;

    addSupplyLog({
      date: selectedDate,
      customerId: cust.id,
      customerName: cust.name,
      customerType: cust.customerType,
      route: cust.route,
      quantityLiters: Number(deliveryLiters),
      unitPrice: cust.unitPrice,
      totalAmount: Number((deliveryLiters * cust.unitPrice).toFixed(2)),
      deliveryStatus: 'Pending',
      paymentStatus: 'Added to Ledger',
      bottlesReturned: 0
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-1 bg-stone-200/70 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setActiveTab('milk')}
              className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'milk'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Milk className="w-3.5 h-3.5 text-emerald-700" />
              <span>Log Milking</span>
            </button>
            <button
              onClick={() => setActiveTab('delivery')}
              className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'delivery'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Log Delivery</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {activeTab === 'milk' ? (
          <form onSubmit={handleMilkSubmit} className="p-6 space-y-4 text-xs">
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Cattle *</label>
              <select
                value={selectedCowId}
                onChange={(e) => setSelectedCowId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white"
              >
                {cattle.map((cow) => (
                  <option key={cow.id} value={cow.id}>
                    {cow.tagNumber} - {cow.name} ({cow.breed})
                  </option>
                ))}
              </select>
            </div>

            {isWithheld && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-medium text-[11px]">
                  Under antibiotic withdrawal. Milk will be automatically flagged for disposal!
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
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

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Yield (Liters) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  required
                  value={liters}
                  onChange={(e) => setLiters(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-300 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Butterfat %</label>
                <input
                  type="number"
                  step="0.1"
                  value={fat}
                  onChange={(e) => setFat(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-300 font-mono"
                />
              </div>
              <div>
                <label className="block text-stone-700 font-semibold mb-1">SNF %</label>
                <input
                  type="number"
                  step="0.1"
                  value={snf}
                  onChange={(e) => setSnf(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-300 font-mono"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs transition-colors"
              >
                Log Yield
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleDeliverySubmit} className="p-6 space-y-4 text-xs">
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Customer *</label>
              <select
                value={selectedCustId}
                onChange={(e) => {
                  setSelectedCustId(e.target.value);
                  const c = customers.find((cust) => cust.id === e.target.value);
                  if (c) setDeliveryLiters(c.dailyQuotaLiters);
                }}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.route})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1">Delivery Volume (Liters) *</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                required
                value={deliveryLiters}
                onChange={(e) => setDeliveryLiters(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-stone-300 font-mono"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs transition-colors"
              >
                Log Route Stop
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
