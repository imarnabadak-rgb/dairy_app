'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useDairy } from '../context/DairyContext';
import { 
  Thermometer, 
  Warehouse, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles,
  Droplets,
  Scale,
  X
} from 'lucide-react';

export const FeedTanksView: React.FC = () => {
  const { tanks, feeds, updateTankTemp, addFeedStock, currencySymbol } = useDairy();

  const [selectedFeedForRestock, setSelectedFeedForRestock] = useState<string | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(500);

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeedForRestock || restockAmount <= 0) return;

    addFeedStock(selectedFeedForRestock, Number(restockAmount));
    setSelectedFeedForRestock(null);
    setRestockAmount(500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
          Bulk Chilling Tanks & Feed Inventory
        </h1>
        <p className="text-xs text-stone-500">
          Milk cold-chain temperature control, CIP sanitation logs, and cattle ration feed stock management
        </p>
      </div>

      {/* Bulk Chilling Tanks Section */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-stone-900">Bulk Milk Chilling Silos</h2>
            <p className="text-xs text-stone-500">
              Grade-A sanitary stainless steel tanks. Regulatory standard: Chilled & maintained &le; 4.0°C within 2 hours of milking.
            </p>
          </div>
          <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 self-start md:self-auto">
            Cold Chain Active · HACCP Compliant
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tanks.map((tank) => {
            const fillPct = Math.min(100, Math.round((tank.currentLiters / tank.capacityLiters) * 100));
            const isTempOptimal = tank.tempCelsius <= 4.0;

            return (
              <div
                key={tank.id}
                className="p-5 rounded-xl border border-stone-200 bg-stone-50/70 space-y-4 hover:border-stone-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">{tank.name}</h3>
                    <p className="text-xs text-stone-500">{tank.milkType}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                      {tank.status}
                    </span>
                  </div>
                </div>

                {/* Fill Gauge */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-medium">
                    <span className="text-stone-600">Storage Volume</span>
                    <span className="font-mono font-bold text-stone-900 tabular-nums">
                      {tank.currentLiters} / {tank.capacityLiters} L ({fillPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-3 rounded-full transition-all"
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-stone-400 mt-1">
                    <span>Headroom available: {tank.capacityLiters - tank.currentLiters} L</span>
                    <span>Sanitized: {tank.lastSanitized}</span>
                  </div>
                </div>

                {/* Temperature Controller */}
                <div className="p-3 bg-white rounded-lg border border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Thermometer className={`w-5 h-5 ${isTempOptimal ? 'text-emerald-700' : 'text-amber-600'}`} />
                    <div>
                      <span className="text-xs text-stone-500 block">Silo Core Temp</span>
                      <strong className={`font-mono text-base font-bold tabular-nums ${isTempOptimal ? 'text-emerald-800' : 'text-amber-800'}`}>
                        {tank.tempCelsius.toFixed(1)}°C
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateTankTemp(tank.id, Number((tank.tempCelsius - 0.2).toFixed(1)))}
                      className="px-2 py-1 text-xs bg-stone-100 hover:bg-stone-200 rounded text-stone-700 font-mono font-bold cursor-pointer"
                      title="Simulate cooling"
                    >
                      -0.2°
                    </button>
                    <button
                      onClick={() => updateTankTemp(tank.id, Number((tank.tempCelsius + 0.2).toFixed(1)))}
                      className="px-2 py-1 text-xs bg-stone-100 hover:bg-stone-200 rounded text-stone-700 font-mono font-bold cursor-pointer"
                      title="Simulate warm intake"
                    >
                      +0.2°
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Chilling Facility Photo Showcase */}
        <div className="mt-6 rounded-xl overflow-hidden border border-emerald-200 relative h-48 bg-emerald-900">
          <Image
            src="/images/dairy_milk_facility_1790960497851.jpg"
            alt="Stainless steel milk processing facility"
            fill
            sizes="(max-width: 768px) 100vw, 1200px"
            className="object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-950/50 to-transparent flex items-end p-5">
            <div>
              <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Sanitary Standards</p>
              <h4 className="text-sm sm:text-base font-bold text-white">Automated CIP Chilling & Pasteurization Line</h4>
              <p className="text-xs text-emerald-100/90 max-w-xl">
                Daily Clean-In-Place chemical cycles at 75°C ensure zero bacterial contamination before cold filling into reusable glass bottles.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feed Inventory Section */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-stone-900">Cattle Feed & Ration Stocks</h2>
            <p className="text-xs text-stone-500">Track dry matter, daily burn rates, and projected stockout dates</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {feeds.map((feed) => {
            const daysLeft = feed.dailyBurnKg > 0 ? Math.floor(feed.stockKg / feed.dailyBurnKg) : 999;
            const isLowStock = feed.stockKg <= feed.minThresholdKg;

            return (
              <div
                key={feed.id}
                className={`p-4 rounded-xl border transition-colors flex flex-col justify-between ${
                  isLowStock ? 'border-amber-300 bg-amber-50/40' : 'border-stone-200 bg-stone-50/50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-xs font-bold text-stone-900">{feed.name}</h3>
                      <span className="text-[11px] text-stone-500">{feed.category}</span>
                    </div>
                    {isLowStock && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                        Low Stock
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 my-2">
                    <span className="text-2xl font-bold font-mono text-stone-900 tabular-nums">
                      {feed.stockKg}
                    </span>
                    <span className="text-xs text-stone-500 font-medium">kg remaining</span>
                  </div>

                  <div className="text-[11px] text-stone-600 space-y-1">
                    <p>Daily Burn: <strong className="tabular-nums font-mono text-stone-800">{feed.dailyBurnKg} kg/day</strong></p>
                    <p>Cost: <strong className="tabular-nums font-mono text-stone-800">{currencySymbol}{feed.costPerKg.toFixed(2)}/kg</strong></p>
                    <p className={`font-semibold ${daysLeft < 7 ? 'text-amber-800' : 'text-emerald-800'}`}>
                      Estimated Supply: ~{daysLeft} days remaining
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-200/80 flex items-center justify-between">
                  <span className="text-[10px] text-stone-400 truncate max-w-[120px]" title={feed.supplier}>
                    {feed.supplier}
                  </span>
                  <button
                    onClick={() => setSelectedFeedForRestock(feed.id)}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Restock</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Restock Feed Modal */}
      {selectedFeedForRestock && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl border border-stone-200">
            <form onSubmit={handleRestockSubmit}>
              <div className="p-5 border-b border-stone-200 flex items-center justify-between">
                <h3 className="text-base font-bold text-stone-900">Restock Feed Inventory</h3>
                <button
                  type="button"
                  onClick={() => setSelectedFeedForRestock(null)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Add Stock Quantity (kg) *</label>
                  <input
                    type="number"
                    step="50"
                    min="10"
                    required
                    value={restockAmount}
                    onChange={(e) => setRestockAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono text-sm font-bold focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFeedForRestock(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs transition-colors"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
