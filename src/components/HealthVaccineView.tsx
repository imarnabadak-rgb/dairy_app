'use client';

import React, { useState } from 'react';
import { useDairy } from '../context/DairyContext';
import { VaccineRecord, VaccineStatus } from '../types/dairy';
import { 
  HeartPulse, 
  ShieldAlert, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  UserCheck, 
  AlertCircle,
  X,
  Syringe
} from 'lucide-react';

export const HealthVaccineView: React.FC = () => {
  const { cattle, vaccines, addVaccineRecord, updateVaccineStatus } = useDairy();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    vaccineName: string;
    targetType: 'Individual' | 'Herd-Wide';
    cattleId: string;
    administeredDate: string;
    nextDueDate: string;
    veterinarian: string;
    batchLot: string;
    dosageMl: number;
    requiresMilkWithdrawal: boolean;
    withdrawalDays: number;
    notes: string;
  }>({
    vaccineName: 'Foot & Mouth Disease (FMD) Bi-Annual Booster',
    targetType: 'Herd-Wide',
    cattleId: cattle[0]?.id || '',
    administeredDate: '2026-10-02',
    nextDueDate: '2027-04-02',
    veterinarian: 'Dr. James Harland, DVM',
    batchLot: 'LOT-VET-8831',
    dosageMl: 3.0,
    requiresMilkWithdrawal: false,
    withdrawalDays: 0,
    notes: 'Routine herd prophylaxis immunization'
  });

  // Filtered vaccines
  const filteredVaccines = vaccines.filter((v) => {
    return statusFilter === 'all' || v.status === statusFilter;
  });

  // Active withdrawal cattle
  const withdrawalCows = cattle.filter((c) => c.healthCondition === 'Withdrawal');

  const handleSaveVaccine = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedCow = cattle.find((c) => c.id === formData.cattleId);
    const targetTag = formData.targetType === 'Herd-Wide' 
      ? 'HERD-ALL' 
      : selectedCow ? `${selectedCow.tagNumber} (${selectedCow.name})` : 'Target Cattle';

    addVaccineRecord({
      vaccineName: formData.vaccineName,
      targetType: formData.targetType,
      cattleId: formData.targetType === 'Individual' ? formData.cattleId : undefined,
      cattleTag: targetTag,
      administeredDate: formData.administeredDate,
      nextDueDate: formData.nextDueDate,
      veterinarian: formData.veterinarian,
      batchLot: formData.batchLot,
      dosageMl: Number(formData.dosageMl),
      status: 'Scheduled',
      requiresMilkWithdrawal: formData.requiresMilkWithdrawal,
      withdrawalDays: Number(formData.withdrawalDays),
      notes: formData.notes || undefined
    });

    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
            Veterinary Health & Vaccination Registry
          </h1>
          <p className="text-xs text-stone-500">
            Immunization schedules, disease prophylaxis, antibiotic withdrawal controls & animal welfare
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs cursor-pointer border border-emerald-800"
        >
          <Plus className="w-4 h-4 text-emerald-100" />
          <span>+ Schedule Vaccine / Treatment</span>
        </button>
      </div>

      {/* Critical Milk Withdrawal Safety Card - Fully responsive for mobile */}
      <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-3.5 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-amber-950">
                Antibiotic Milk Withdrawal & Food Safety Compliance
              </h2>
              <p className="text-xs text-amber-900 mt-1 leading-relaxed max-w-3xl">
                Veterinary withdrawal periods guarantee that zero chemical or antibiotic residues enter the human food chain.
                Any milk harvested during an active withdrawal window must be tested and segregated.
              </p>
            </div>
          </div>
          <div className="flex items-center sm:block justify-between sm:text-right shrink-0 bg-amber-100/70 sm:bg-transparent px-3 py-2 sm:p-0 rounded-lg border border-amber-200 sm:border-0">
            <span className="text-xs sm:hidden font-semibold text-amber-900">Quarantine count:</span>
            <div className="flex items-baseline sm:block gap-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-amber-900 tabular-nums">
                {withdrawalCows.length}
              </span>
              <span className="text-xs text-amber-800 sm:block">under withdrawal</span>
            </div>
          </div>
        </div>

        {withdrawalCows.length > 0 ? (
          <div className="mt-4 pt-3 border-t border-amber-200/70 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {withdrawalCows.map((cow) => (
              <div key={cow.id} className="p-3 bg-white/80 rounded-lg border border-amber-200 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-stone-900">
                    {cow.tagNumber} - {cow.name} ({cow.breed})
                  </span>
                  <span className="font-mono text-amber-800 font-bold">
                    Ends: {cow.withdrawalEndDate || 'Active'}
                  </span>
                </div>
                <p className="text-stone-600 text-[11px]">
                  {cow.activeTreatmentNotes || 'Medical therapy ongoing. Milk discarded at every milking.'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-xs text-emerald-800 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>All lactating cows are cleared of medical withdrawal restrictions. 100% of yield is food-safe.</span>
          </div>
        )}
      </div>

      {/* Vaccine Schedule & Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-stone-600 bg-stone-100 hover:bg-stone-200'
              }`}
            >
              All Records ({vaccines.length})
            </button>
            <button
              onClick={() => setStatusFilter('Scheduled')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'Scheduled'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-stone-600 bg-stone-100 hover:bg-stone-200'
              }`}
            >
              Scheduled / Upcoming
            </button>
            <button
              onClick={() => setStatusFilter('Completed')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'Completed'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-stone-600 bg-stone-100 hover:bg-stone-200'
              }`}
            >
              Completed
            </button>
          </div>

          <span className="text-xs text-stone-500">
            Bi-Annual Prophylaxis: FMD, HS+BQ, Brucellosis, Deworming
          </span>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
          {/* Mobile Card List View (sm:hidden) - Prevents table overflow and layout disturbance */}
          <div className="sm:hidden divide-y divide-stone-100">
            {filteredVaccines.map((v) => {
              const isCompleted = v.status === 'Completed';
              return (
                <div key={v.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-800 shrink-0">
                        <Syringe className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-stone-900 text-xs">{v.vaccineName}</p>
                        <span className="text-[11px] text-stone-500">Target: {v.cattleTag} ({v.targetType})</span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-3 h-3 text-emerald-700" /> : <Clock className="w-3 h-3 text-amber-700" />}
                      <span>{v.status}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-stone-50 p-2.5 rounded-lg border border-stone-200/60">
                    <div>
                      <span className="text-stone-400 block text-[10px]">Next Due</span>
                      <span className="font-mono font-bold text-stone-900">{v.nextDueDate}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">Withholding</span>
                      {v.requiresMilkWithdrawal ? (
                        <span className="text-amber-800 font-bold bg-amber-50 px-1 py-0.5 rounded border border-amber-200 inline-block">
                          {v.withdrawalDays} days
                        </span>
                      ) : (
                        <span className="text-stone-500">None</span>
                      )}
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">Administered</span>
                      <span className="font-mono text-stone-700">{v.administeredDate}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">Vet</span>
                      <span className="text-stone-700 truncate block">{v.veterinarian}</span>
                    </div>
                  </div>

                  {!isCompleted && (
                    <button
                      onClick={() => updateVaccineStatus(v.id, 'Completed')}
                      className="w-full py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer shadow-xs text-center"
                    >
                      Mark Done
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tablet & Desktop Table View (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Vaccine & Disease</th>
                  <th className="py-3 px-4">Target Cattle</th>
                  <th className="py-3 px-4">Administered</th>
                  <th className="py-3 px-4">Next Due Date</th>
                  <th className="py-3 px-4">Batch Lot & Dose</th>
                  <th className="py-3 px-4">Withholding</th>
                  <th className="py-3 px-4">Veterinarian</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filteredVaccines.map((v) => {
                  const isCompleted = v.status === 'Completed';

                  return (
                    <tr key={v.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Syringe className="w-4 h-4 text-emerald-700 shrink-0" />
                          <div>
                            <p className="font-bold text-stone-900 text-xs">{v.vaccineName}</p>
                            <span className="text-[11px] text-stone-400">{v.targetType}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold text-stone-800">
                        {v.cattleTag}
                      </td>

                      <td className="py-3 px-4 text-stone-600 font-mono">
                        {v.administeredDate}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-stone-900">
                        {v.nextDueDate}
                      </td>

                      <td className="py-3 px-4 text-stone-600">
                        <span className="font-mono text-[11px]">{v.batchLot}</span>
                        <span className="text-stone-400 text-[10px] ml-1">({v.dosageMl}ml)</span>
                      </td>

                      <td className="py-3 px-4">
                        {v.requiresMilkWithdrawal ? (
                          <span className="text-amber-800 font-bold text-[11px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            {v.withdrawalDays} days
                          </span>
                        ) : (
                          <span className="text-stone-400 text-[11px]">None</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-stone-700">
                        {v.veterinarian}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 className="w-3 h-3 text-emerald-700" /> : <Clock className="w-3 h-3 text-amber-700" />}
                          <span>{v.status}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {!isCompleted && (
                          <button
                            onClick={() => updateVaccineStatus(v.id, 'Completed')}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition-colors cursor-pointer shadow-xs"
                          >
                            Mark Done
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredVaccines.length === 0 && (
            <div className="py-12 text-center text-stone-500">
              <p className="text-sm font-semibold">No vaccination records match this filter</p>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Vaccine Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl border border-stone-200">
            <form onSubmit={handleSaveVaccine}>
              <div className="p-5 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="text-base font-bold text-stone-900">Schedule Veterinary Vaccination</h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Vaccine / Disease Protocol *</label>
                  <input
                    type="text"
                    required
                    value={formData.vaccineName}
                    onChange={(e) => setFormData({ ...formData, vaccineName: e.target.value })}
                    placeholder="e.g. Foot & Mouth Disease (FMD) Bi-Annual"
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Target Application</label>
                    <select
                      value={formData.targetType}
                      onChange={(e) => setFormData({ ...formData, targetType: e.target.value as 'Individual' | 'Herd-Wide' })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white"
                    >
                      <option value="Herd-Wide">Entire Herd (Herd-Wide)</option>
                      <option value="Individual">Specific Individual Cattle</option>
                    </select>
                  </div>

                  {formData.targetType === 'Individual' ? (
                    <div>
                      <label className="block text-stone-700 font-semibold mb-1">Select Cattle *</label>
                      <select
                        value={formData.cattleId}
                        onChange={(e) => setFormData({ ...formData, cattleId: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white"
                      >
                        {cattle.map((cow) => (
                          <option key={cow.id} value={cow.id}>
                            {cow.tagNumber} - {cow.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-stone-700 font-semibold mb-1">Coverage Scope</label>
                      <div className="p-2 bg-stone-100 rounded-lg text-stone-600 text-[11px]">
                        All {cattle.length} cattle in farm registry
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Administered Date</label>
                    <input
                      type="date"
                      value={formData.administeredDate}
                      onChange={(e) => setFormData({ ...formData, administeredDate: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Next Due Booster Date</label>
                    <input
                      type="date"
                      value={formData.nextDueDate}
                      onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Veterinarian Name</label>
                    <input
                      type="text"
                      value={formData.veterinarian}
                      onChange={(e) => setFormData({ ...formData, veterinarian: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Batch / Lot Number</label>
                    <input
                      type="text"
                      value={formData.batchLot}
                      onChange={(e) => setFormData({ ...formData, batchLot: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 font-mono"
                    />
                  </div>
                </div>

                {/* Milk withdrawal config */}
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="withdrawalCheckbox"
                      checked={formData.requiresMilkWithdrawal}
                      onChange={(e) => setFormData({ ...formData, requiresMilkWithdrawal: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <label htmlFor="withdrawalCheckbox" className="font-semibold text-stone-800">
                      Requires Mandatory Milk Withholding (Antibiotic / Chemical)
                    </label>
                  </div>

                  {formData.requiresMilkWithdrawal && (
                    <div className="pl-6">
                      <label className="block text-stone-600 font-medium mb-1">
                        Withholding Duration (Days):
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={formData.withdrawalDays}
                        onChange={(e) => setFormData({ ...formData, withdrawalDays: Number(e.target.value) })}
                        className="w-24 px-2 py-1 border border-stone-300 rounded font-mono text-xs"
                      />
                      <p className="text-[10px] text-amber-800 mt-1">
                        Selected cattle will be automatically flagged in withdrawal state to prevent milk delivery contamination.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Clinical Notes</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300"
                    placeholder="Adverse reactions, injection site, dosage remarks..."
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
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs transition-colors"
                >
                  Schedule Vaccine Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
