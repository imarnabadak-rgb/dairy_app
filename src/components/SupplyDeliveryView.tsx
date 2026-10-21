'use client';

import React, { useState } from 'react';
import { useDairy } from '../context/DairyContext';
import { DailySupplyLog, DeliveryStatus } from '../types/dairy';
import { 
  Truck, 
  CheckCircle2, 
  Clock, 
  Plus, 
  DollarSign, 
  Calendar,
  X,
  CreditCard
} from 'lucide-react';

export const SupplyDeliveryView: React.FC = () => {
  const {
    supplyLogs,
    customers,
    selectedDate,
    setSelectedDate,
    currencySymbol,
    toggleDeliveryStatus,
    togglePaymentStatus,
    addSupplyLog,
    updateSupplyLogQuantity,
    markAllDeliveriesDelivered
  } = useDairy();

  const [routeFilter, setRouteFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddDispatchOpen, setIsAddDispatchOpen] = useState(false);

  // New dispatch form state
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [customQty, setCustomQty] = useState<number>(3.0);
  const [customNotes, setCustomNotes] = useState('');

  // Filtered supply logs for selectedDate
  const currentLogs = supplyLogs.filter((s) => s.date === selectedDate);
  const filteredLogs = currentLogs.filter((item) => {
    const matchesRoute = routeFilter === 'all' || item.route === routeFilter;
    const matchesStatus = statusFilter === 'all' || item.deliveryStatus === statusFilter;
    return matchesRoute && matchesStatus;
  });

  // Unique routes
  const availableRoutes = Array.from(new Set(currentLogs.map((s) => s.route)));

  // Aggregate metrics
  const totalLitersTarget = currentLogs.reduce((acc, s) => acc + s.quantityLiters, 0);
  const deliveredLiters = currentLogs
    .filter((s) => s.deliveryStatus === 'Delivered')
    .reduce((acc, s) => acc + s.quantityLiters, 0);
  const totalRevenueDue = currentLogs.reduce((acc, s) => acc + s.totalAmount, 0);
  const collectedPaid = currentLogs
    .filter((s) => s.paymentStatus === 'Paid')
    .reduce((acc, s) => acc + s.totalAmount, 0);
  const deliveredCount = currentLogs.filter((s) => s.deliveryStatus === 'Delivered').length;
  const pendingCount = currentLogs.filter((s) => s.deliveryStatus === 'Pending').length;
  const totalBottlesReturned = currentLogs.reduce((acc, s) => acc + (s.bottlesReturned || 0), 0);

  const handleAddDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === selectedCustomerId);
    if (!cust) return;

    const totalAmt = Number((customQty * cust.unitPrice).toFixed(2));
    addSupplyLog({
      date: selectedDate,
      customerId: cust.id,
      customerName: cust.name,
      customerType: cust.customerType,
      route: cust.route,
      quantityLiters: Number(customQty),
      unitPrice: cust.unitPrice,
      totalAmount: totalAmt,
      deliveryStatus: 'Pending',
      paymentStatus: 'Added to Ledger',
      bottlesReturned: 0,
      notes: customNotes || undefined
    });

    setIsAddDispatchOpen(false);
    setCustomNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
            Daily Supply & Delivery Manifest
          </h1>
          <p className="text-xs text-stone-500">
            Real-time route tracking, delivery confirmation, glass bottle returns & revenue collection
          </p>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Mark all remaining pending deliveries as Delivered now?')) {
                  markAllDeliveriesDelivered();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>Mark All Delivered</span>
            </button>
          )}

          <button
            onClick={() => {
              if (customers.length > 0) {
                setSelectedCustomerId(customers[0].id);
                setCustomQty(customers[0].dailyQuotaLiters);
              }
              setIsAddDispatchOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>+ Add Delivery Stop</span>
          </button>
        </div>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-[11px] font-medium text-stone-500 block">Deliveries Completed</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-stone-900 tabular-nums">
              {deliveredCount} / {currentLogs.length}
            </span>
            <span className="text-xs text-stone-500">stops</span>
          </div>
          <span className="text-[11px] text-stone-400 mt-1 block">
            {pendingCount} remaining in delivery route
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-[11px] font-medium text-stone-500 block">Milk Volume Dispatched</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-emerald-800 tabular-nums">
              {deliveredLiters.toFixed(1)}
            </span>
            <span className="text-xs text-emerald-600">/ {totalLitersTarget.toFixed(1)} L</span>
          </div>
          <span className="text-[11px] text-stone-400 mt-1 block">
            Target daily route quota
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-[11px] font-medium text-stone-500 block">Today's Route Revenue</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-stone-400 text-base">{currencySymbol}</span>
            <span className="text-2xl font-bold text-stone-900 tabular-nums">
              {totalRevenueDue.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 font-medium mt-1 block">
            {currencySymbol}{collectedPaid.toFixed(2)} collected immediately
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-[11px] font-medium text-stone-500 block">Glass Bottles Returned</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-sky-800 tabular-nums">
              {totalBottlesReturned}
            </span>
            <span className="text-xs text-sky-600">bottles</span>
          </div>
          <span className="text-[11px] text-stone-400 mt-1 block">
            Returned for eco-friendly sanitizing
          </span>
        </div>
      </div>

      {/* Filter and Date Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-stone-400" />
          <span className="text-xs font-semibold text-stone-700">Delivery Date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs font-medium bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Route filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-stone-500">Route:</label>
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
            >
              <option value="all">All Delivery Routes</option>
              {availableRoutes.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-stone-500">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Delivered">Delivered</option>
              <option value="Pending">Pending</option>
              <option value="Skipped">Skipped / Paused</option>
            </select>
          </div>
        </div>
      </div>

      {/* Delivery Manifest Sheet */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Fulfill</th>
                <th className="py-3 px-4">Customer & Type</th>
                <th className="py-3 px-4">Route Area</th>
                <th className="py-3 px-4 text-right">Liters Ordered</th>
                <th className="py-3 px-4 text-right">Rate / Total</th>
                <th className="py-3 px-4 text-center">Bottle Returns</th>
                <th className="py-3 px-4">Payment Status</th>
                <th className="py-3 px-4">Delivery Time</th>
                <th className="py-3 px-4">Delivery Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {filteredLogs.map((item) => {
                const isDelivered = item.deliveryStatus === 'Delivered';
                const isPaid = item.paymentStatus === 'Paid';

                return (
                  <tr key={item.id} className="hover:bg-stone-50/70 transition-colors">
                    {/* Checkbox toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggleDeliveryStatus(item.id, isDelivered ? 'Pending' : 'Delivered')}
                        className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer mx-auto ${
                          isDelivered
                            ? 'bg-emerald-600 text-white'
                            : 'border border-neutral-300 text-transparent hover:border-emerald-500'
                        }`}
                        title={isDelivered ? 'Mark as Pending' : 'Mark as Delivered'}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-4">
                      <p className="font-bold text-stone-900 text-xs">{item.customerName}</p>
                      <span className="text-[11px] text-stone-500">{item.customerType}</span>
                    </td>

                    {/* Route */}
                    <td className="py-3 px-4 text-stone-600">
                      {item.route}
                    </td>

                    {/* Liters ordered with inline quick edit */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={item.quantityLiters}
                          onChange={(e) => updateSupplyLogQuantity(item.id, Number(e.target.value))}
                          className="w-16 px-1.5 py-0.5 border border-stone-200 rounded text-right font-mono font-bold text-stone-900 tabular-nums text-xs"
                        />
                        <span className="text-stone-400">L</span>
                      </div>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <div className="font-bold text-stone-900">
                        {currencySymbol}{item.totalAmount.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-stone-400">
                        @{currencySymbol}{item.unitPrice.toFixed(2)}/L
                      </div>
                    </td>

                    {/* Bottle returns */}
                    <td className="py-3 px-4 text-center font-mono tabular-nums">
                      <span className="bg-sky-50 text-sky-800 px-2 py-0.5 rounded border border-sky-200 text-xs font-semibold">
                        {item.bottlesReturned || 0} returned
                      </span>
                    </td>

                    {/* Payment toggle */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => togglePaymentStatus(item.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                            : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-300'
                        }`}
                        title="Click to toggle payment state"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>{item.paymentStatus}</span>
                      </button>
                    </td>

                    {/* Delivery Time */}
                    <td className="py-3 px-4">
                      {isDelivered ? (
                        <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.deliveredAt || '07:00 AM'}
                        </span>
                      ) : (
                        <span className="text-stone-400 text-[11px] italic">
                          Awaiting drop-off
                        </span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-4 text-stone-500 max-w-[180px] truncate" title={item.notes}>
                      {item.notes || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="py-12 text-center text-stone-500">
            <p className="text-sm font-semibold">No deliveries found for this date and filter</p>
            <p className="text-xs text-stone-400 mt-1">
              Add a customer dispatch stop to populate today's route manifest.
            </p>
          </div>
        )}
      </div>

      {/* Add Dispatch Stop Modal */}
      {isAddDispatchOpen && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-stone-200">
            <form onSubmit={handleAddDispatch}>
              <div className="p-5 border-b border-stone-200 flex items-center justify-between">
                <h3 className="text-base font-bold text-stone-900">Add Route Delivery Stop</h3>
                <button
                  type="button"
                  onClick={() => setIsAddDispatchOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Select Customer *</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value);
                      const c = customers.find((cust) => cust.id === e.target.value);
                      if (c) setCustomQty(c.dailyQuotaLiters);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.route} - Quota: {c.dailyQuotaLiters}L)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Delivery Liters *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={customQty}
                    onChange={(e) => setCustomQty(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Driver Instructions / Notes</label>
                  <input
                    type="text"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="e.g. Leave in porch ice chest, collect empty bottles"
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddDispatchOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs"
                >
                  Add to Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
