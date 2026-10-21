'use client';

import React, { useState } from 'react';
import { useDairy } from '../context/DairyContext';
import { formatMonthDay } from '../lib/date';
import { Cattle, BreedType, CowStatus, HealthCondition } from '../types/dairy';
import { 
  Search, 
  Plus, 
  Eye, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  X, 
  Check, 
  Layers,
  Sparkles
} from 'lucide-react';

interface CattleViewProps {
  onNavigateToAi?: () => void;
}

export const CattleView: React.FC<CattleViewProps> = ({ onNavigateToAi }) => {
  const { cattle, addCattle, updateCattle, deleteCattle, milkLogs, vaccines } = useDairy();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [breedFilter, setBreedFilter] = useState<string>('all');
  const [selectedCow, setSelectedCow] = useState<Cattle | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [cowToEdit, setCowToEdit] = useState<Cattle | null>(null);

  // Form states for Add / Edit
  const [formData, setFormData] = useState<{
    tagNumber: string;
    name: string;
    breed: BreedType;
    status: CowStatus;
    healthCondition: HealthCondition;
    dob: string;
    lactationCycle: number;
    lastCalvingDate: string;
    expectedCalvingDate: string;
    avgDailyYield: number;
    weightKg: number;
    silageKg: number;
    concentrateKg: number;
    greenFodderKg: number;
    mineralsG: number;
    activeTreatmentNotes: string;
    notes: string;
  }>({
    tagNumber: '',
    name: '',
    breed: 'Holstein Friesian',
    status: 'Lactating',
    healthCondition: 'Healthy',
    dob: '2023-01-01',
    lactationCycle: 1,
    lastCalvingDate: '2026-06-01',
    expectedCalvingDate: '',
    avgDailyYield: 22,
    weightKg: 550,
    silageKg: 20,
    concentrateKg: 7,
    greenFodderKg: 15,
    mineralsG: 100,
    activeTreatmentNotes: '',
    notes: ''
  });

  // Filtered cattle
  const filteredCattle = cattle.filter((cow) => {
    const matchesSearch =
      cow.tagNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cow.breed.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || cow.status === statusFilter;
    const matchesBreed = breedFilter === 'all' || cow.breed === breedFilter;
    return matchesSearch && matchesStatus && matchesBreed;
  });

  const handleOpenAddModal = () => {
    const nextNumber = cattle.length + 101;
    setFormData({
      tagNumber: `DF-${nextNumber}`,
      name: '',
      breed: 'Holstein Friesian',
      status: 'Lactating',
      healthCondition: 'Healthy',
      dob: '2023-01-01',
      lactationCycle: 1,
      lastCalvingDate: '2026-06-01',
      expectedCalvingDate: '',
      avgDailyYield: 24,
      weightKg: 560,
      silageKg: 20,
      concentrateKg: 7,
      greenFodderKg: 15,
      mineralsG: 100,
      activeTreatmentNotes: '',
      notes: ''
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (cow: Cattle) => {
    setCowToEdit(cow);
    setFormData({
      tagNumber: cow.tagNumber,
      name: cow.name,
      breed: cow.breed,
      status: cow.status,
      healthCondition: cow.healthCondition,
      dob: cow.dob,
      lactationCycle: cow.lactationCycle,
      lastCalvingDate: cow.lastCalvingDate || '',
      expectedCalvingDate: cow.expectedCalvingDate || '',
      avgDailyYield: cow.avgDailyYield,
      weightKg: cow.weightKg,
      silageKg: cow.feedRation.silageKg,
      concentrateKg: cow.feedRation.concentrateKg,
      greenFodderKg: cow.feedRation.greenFodderKg,
      mineralsG: cow.feedRation.mineralsG,
      activeTreatmentNotes: cow.activeTreatmentNotes || '',
      notes: cow.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tagNumber.trim() || !formData.name.trim()) return;

    addCattle({
      tagNumber: formData.tagNumber.trim(),
      name: formData.name.trim(),
      breed: formData.breed,
      status: formData.status,
      healthCondition: formData.healthCondition,
      dob: formData.dob,
      lactationCycle: Number(formData.lactationCycle),
      lastCalvingDate: formData.lastCalvingDate || undefined,
      expectedCalvingDate: formData.expectedCalvingDate || undefined,
      avgDailyYield: Number(formData.avgDailyYield),
      weightKg: Number(formData.weightKg),
      feedRation: {
        silageKg: Number(formData.silageKg),
        concentrateKg: Number(formData.concentrateKg),
        greenFodderKg: Number(formData.greenFodderKg),
        mineralsG: Number(formData.mineralsG)
      },
      activeTreatmentNotes: formData.activeTreatmentNotes || undefined,
      notes: formData.notes || undefined
    });
    setIsAddModalOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cowToEdit) return;

    updateCattle(cowToEdit.id, {
      tagNumber: formData.tagNumber.trim(),
      name: formData.name.trim(),
      breed: formData.breed,
      status: formData.status,
      healthCondition: formData.healthCondition,
      dob: formData.dob,
      lactationCycle: Number(formData.lactationCycle),
      lastCalvingDate: formData.lastCalvingDate || undefined,
      expectedCalvingDate: formData.expectedCalvingDate || undefined,
      avgDailyYield: Number(formData.avgDailyYield),
      weightKg: Number(formData.weightKg),
      feedRation: {
        silageKg: Number(formData.silageKg),
        concentrateKg: Number(formData.concentrateKg),
        greenFodderKg: Number(formData.greenFodderKg),
        mineralsG: Number(formData.mineralsG)
      },
      activeTreatmentNotes: formData.activeTreatmentNotes || undefined,
      notes: formData.notes || undefined
    });

    if (selectedCow && selectedCow.id === cowToEdit.id) {
      setSelectedCow({
        ...cowToEdit,
        tagNumber: formData.tagNumber,
        name: formData.name,
        breed: formData.breed,
        status: formData.status,
        healthCondition: formData.healthCondition,
        dob: formData.dob,
        lactationCycle: Number(formData.lactationCycle),
        lastCalvingDate: formData.lastCalvingDate || undefined,
        expectedCalvingDate: formData.expectedCalvingDate || undefined,
        avgDailyYield: Number(formData.avgDailyYield),
        weightKg: Number(formData.weightKg),
        feedRation: {
          silageKg: Number(formData.silageKg),
          concentrateKg: Number(formData.concentrateKg),
          greenFodderKg: Number(formData.greenFodderKg),
          mineralsG: Number(formData.mineralsG)
        }
      });
    }
    setIsEditModalOpen(false);
    setCowToEdit(null);
  };

  const handleDeleteCow = (cow: Cattle) => {
    if (window.confirm(`Are you sure you want to remove ${cow.name} (${cow.tagNumber}) from the herd registry?`)) {
      deleteCattle(cow.id);
      if (selectedCow?.id === cow.id) {
        setSelectedCow(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            Cattle Herd Registry
          </h1>
          <p className="text-xs text-neutral-500">
            Detailed profiles, lactation cycles, pedigree, health monitoring & feed plans
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onNavigateToAi && (
            <button
              onClick={onNavigateToAi}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>AI Milk & Health Optimizer</span>
            </button>
          )}
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>+ Register New Cattle</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center gap-3 justify-between">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by tag, cow name or breed..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50/50 focus:outline-hidden focus:border-emerald-600 focus:bg-white transition-colors"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-500 whitespace-nowrap">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg border border-stone-200 bg-stone-50/50 py-1.5 px-2.5 text-stone-700 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
          >
            <option value="all">All Stages ({cattle.length})</option>
            <option value="Lactating">Lactating</option>
            <option value="Pregnant">Pregnant</option>
            <option value="Dry">Dry Period</option>
            <option value="Heifer">Heifer</option>
            <option value="Calf">Calf</option>
          </select>
        </div>

        {/* Breed Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-500 whitespace-nowrap">Breed:</label>
          <select
            value={breedFilter}
            onChange={(e) => setBreedFilter(e.target.value)}
            className="text-xs rounded-lg border border-stone-200 bg-stone-50/50 py-1.5 px-2.5 text-stone-700 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
          >
            <option value="all">All Breeds</option>
            <option value="Holstein Friesian">Holstein Friesian</option>
            <option value="Jersey">Jersey</option>
            <option value="Gir">Gir (Indigenous A2)</option>
            <option value="Sahiwal">Sahiwal (Indigenous A2)</option>
            <option value="Brown Swiss">Brown Swiss</option>
            <option value="Crossbreed">Crossbreed</option>
          </select>
        </div>
      </div>

      {/* Cattle Table Grid */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Tag & Name</th>
                <th className="py-3 px-4">Breed</th>
                <th className="py-3 px-4">Lifecycle Status</th>
                <th className="py-3 px-4">Health Condition</th>
                <th className="py-3 px-4 text-right">Lactation / Parity</th>
                <th className="py-3 px-4 text-right">Avg Daily Yield</th>
                <th className="py-3 px-4 text-right">Live Weight</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {filteredCattle.map((cow) => {
                const isUnderWithdrawal = cow.healthCondition === 'Withdrawal';
                const isPregnant = cow.status === 'Pregnant';

                return (
                  <tr key={cow.id} className="hover:bg-stone-50/70 transition-colors">
                    {/* Tag & Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-1 rounded text-[11px] border border-stone-200">
                          {cow.tagNumber}
                        </span>
                        <div>
                          <p className="font-bold text-stone-900 text-xs">{cow.name}</p>
                          <p className="text-[11px] text-stone-400">DOB: {cow.dob}</p>
                        </div>
                      </div>
                    </td>

                    {/* Breed */}
                    <td className="py-3 px-4 font-medium text-stone-800">
                      {cow.breed}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 font-medium text-stone-800">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            cow.status === 'Lactating'
                              ? 'bg-emerald-600'
                              : isPregnant
                              ? 'bg-sky-600'
                              : cow.status === 'Dry'
                              ? 'bg-amber-500'
                              : 'bg-stone-400'
                          }`}
                        />
                        <span>{cow.status}</span>
                        {isPregnant && cow.expectedCalvingDate && (
                          <span className="text-[10px] text-stone-400">
                            (Calving {formatMonthDay(cow.expectedCalvingDate)})
                          </span>
                        )}
                      </span>
                    </td>

                    {/* Health Condition */}
                    <td className="py-3 px-4">
                      {isUnderWithdrawal ? (
                        <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-bold text-[11px] border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Withdrawal Active
                        </span>
                      ) : cow.healthCondition === 'Observation' ? (
                        <span className="text-amber-700 font-semibold text-[11px]">
                          Under Observation
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium text-[11px]">
                          Healthy & Robust
                        </span>
                      )}
                    </td>

                    {/* Lactation Cycle */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {cow.lactationCycle > 0 ? `#${cow.lactationCycle}` : 'Heifer (0)'}
                    </td>

                    {/* Avg Yield */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-stone-900 tabular-nums">
                      {cow.avgDailyYield > 0 ? `${cow.avgDailyYield.toFixed(1)} L` : '—'}
                    </td>

                    {/* Weight */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-600">
                      {cow.weightKg} kg
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {onNavigateToAi && (
                          <button
                            onClick={onNavigateToAi}
                            title="AI Health Diagnosis & Milk Maximizer"
                            className="p-1.5 text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer border border-emerald-300"
                          >
                            <Sparkles className="w-4 h-4 text-emerald-700" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedCow(cow)}
                          title="View Full Profile & Milk Records"
                          className="p-1.5 text-stone-600 hover:text-emerald-800 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(cow)}
                          title="Edit Cattle Information"
                          className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCow(cow)}
                          title="Delete Cattle Record"
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
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

        {filteredCattle.length === 0 && (
          <div className="py-12 text-center text-stone-500">
            <p className="text-sm font-semibold">No cattle match your search criteria</p>
            <p className="text-xs text-stone-400 mt-1">Try clearing filters or search by a different tag or name.</p>
          </div>
        )}
      </div>

      {/* Cow Profile Modal / Drawer */}
      {selectedCow && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-stone-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm bg-stone-100 text-stone-900 px-2.5 py-1 rounded-md border border-stone-200">
                  {selectedCow.tagNumber}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-stone-900">{selectedCow.name}</h3>
                  <p className="text-xs text-stone-500">{selectedCow.breed} · {selectedCow.status}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCow(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 text-xs text-stone-700">
              {/* Alert if under withdrawal */}
              {selectedCow.healthCondition === 'Withdrawal' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900">
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Active Antibiotic Milk Withholding</span>
                  </div>
                  <p className="text-xs mb-2 leading-relaxed">
                    {selectedCow.activeTreatmentNotes || 'Cow is undergoing veterinary treatment.'}
                  </p>
                  <p className="text-[11px] font-semibold text-amber-800">
                    Withholding ends: {selectedCow.withdrawalEndDate || 'Pending vet clearance'}
                  </p>
                </div>
              )}

              {/* Vital Specifications Grid */}
              <div>
                <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider mb-3">Vital Specifications</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                    <span className="text-[11px] text-stone-400 block mb-0.5">Average Yield</span>
                    <span className="text-sm font-bold font-mono text-stone-900 tabular-nums">
                      {selectedCow.avgDailyYield} L / day
                    </span>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                    <span className="text-[11px] text-stone-400 block mb-0.5">Current Weight</span>
                    <span className="text-sm font-bold font-mono text-stone-900 tabular-nums">
                      {selectedCow.weightKg} kg
                    </span>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                    <span className="text-[11px] text-stone-400 block mb-0.5">Lactation Parity</span>
                    <span className="text-sm font-bold font-mono text-stone-900 tabular-nums">
                      Cycle #{selectedCow.lactationCycle}
                    </span>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                    <span className="text-[11px] text-stone-400 block mb-0.5">Birth Date</span>
                    <span className="text-sm font-bold font-mono text-stone-900 tabular-nums">
                      {selectedCow.dob}
                    </span>
                  </div>
                </div>
              </div>

              {/* Feed Ration Breakdown */}
              <div>
                <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider mb-3">Daily Feed Ration Formulation</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                  <div>
                    <span className="text-[11px] text-stone-500 block">Corn Silage:</span>
                    <span className="font-bold text-stone-900 font-mono tabular-nums text-xs">{selectedCow.feedRation.silageKg} kg/day</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-stone-500 block">High-Protein Pellets:</span>
                    <span className="font-bold text-stone-900 font-mono tabular-nums text-xs">{selectedCow.feedRation.concentrateKg} kg/day</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-stone-500 block">Green Fodder / Pasture:</span>
                    <span className="font-bold text-stone-900 font-mono tabular-nums text-xs">{selectedCow.feedRation.greenFodderKg} kg/day</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-stone-500 block">Mineral Supplement:</span>
                    <span className="font-bold text-stone-900 font-mono tabular-nums text-xs">{selectedCow.feedRation.mineralsG} g/day</span>
                  </div>
                </div>
              </div>

              {/* Recent Milking Records for this cow */}
              <div>
                <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider mb-2">Recent Milk Logs</h4>
                {milkLogs.filter((m) => m.cowId === selectedCow.id || m.cowTag === selectedCow.tagNumber).length > 0 ? (
                  <div className="border border-stone-200 rounded-lg divide-y divide-stone-100 overflow-hidden">
                    {milkLogs
                      .filter((m) => m.cowId === selectedCow.id || m.cowTag === selectedCow.tagNumber)
                      .slice(0, 4)
                      .map((log) => (
                        <div key={log.id} className="p-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-stone-800">{log.date} ({log.session})</span>
                            <span className="text-stone-400 text-[11px] ml-2">Milker: {log.milkerName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-stone-600 text-[11px]">Fat: {log.fatPercentage}% · SNF: {log.snfPercentage}%</span>
                            <span className="font-bold text-stone-900 font-mono tabular-nums">{log.liters.toFixed(1)} L</span>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 italic">No specific yield records recorded yet.</p>
                )}
              </div>

              {/* Notes */}
              {selectedCow.notes && (
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-stone-600">
                  <span className="font-semibold text-stone-800 block mb-1">Breeder Notes:</span>
                  <p className="text-xs leading-relaxed">{selectedCow.notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedCow(null);
                  handleOpenEditModal(selectedCow);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
              >
                Edit Cow Data
              </button>
              <button
                onClick={() => setSelectedCow(null)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Cattle Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-stone-200">
            <form onSubmit={isAddModalOpen ? handleSaveAdd : handleSaveEdit}>
              <div className="p-5 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="text-base font-bold text-stone-900">
                  {isAddModalOpen ? 'Register New Herd Cattle' : `Edit Cattle Details (${formData.tagNumber})`}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Tag Number *</label>
                    <input
                      type="text"
                      required
                      value={formData.tagNumber}
                      onChange={(e) => setFormData({ ...formData, tagNumber: e.target.value })}
                      placeholder="e.g. DF-111"
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Cow Name / Identifier *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Jasmine"
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Breed</label>
                    <select
                      value={formData.breed}
                      onChange={(e) => setFormData({ ...formData, breed: e.target.value as BreedType })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600 bg-white"
                    >
                      <option value="Holstein Friesian">Holstein Friesian</option>
                      <option value="Jersey">Jersey</option>
                      <option value="Gir">Gir (Indigenous A2)</option>
                      <option value="Sahiwal">Sahiwal (Indigenous A2)</option>
                      <option value="Brown Swiss">Brown Swiss</option>
                      <option value="Crossbreed">Crossbreed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Lifecycle Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as CowStatus })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600 bg-white"
                    >
                      <option value="Lactating">Lactating</option>
                      <option value="Pregnant">Pregnant</option>
                      <option value="Dry">Dry Period</option>
                      <option value="Heifer">Heifer</option>
                      <option value="Calf">Calf</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Health Condition</label>
                    <select
                      value={formData.healthCondition}
                      onChange={(e) => setFormData({ ...formData, healthCondition: e.target.value as HealthCondition })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600 bg-white"
                    >
                      <option value="Healthy">Healthy</option>
                      <option value="Observation">Under Observation</option>
                      <option value="Treatment">Under Treatment</option>
                      <option value="Withdrawal">Antibiotic Withdrawal (Milk Withheld)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Lactation Cycle / Parity</label>
                    <input
                      type="number"
                      min={0}
                      max={12}
                      value={formData.lactationCycle}
                      onChange={(e) => setFormData({ ...formData, lactationCycle: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Expected Daily Yield (Liters)</label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      value={formData.avgDailyYield}
                      onChange={(e) => setFormData({ ...formData, avgDailyYield: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Live Weight (kg)</label>
                    <input
                      type="number"
                      min={50}
                      max={1200}
                      value={formData.weightKg}
                      onChange={(e) => setFormData({ ...formData, weightKg: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Last Calving Date</label>
                    <input
                      type="date"
                      value={formData.lastCalvingDate}
                      onChange={(e) => setFormData({ ...formData, lastCalvingDate: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>
                </div>

                {/* Ration settings */}
                <div className="pt-2 border-t border-stone-200">
                  <span className="font-semibold text-stone-800 block mb-2">Daily Ration Allocation (kg / g)</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-[11px] text-stone-500">Silage (kg):</span>
                      <input
                        type="number"
                        step="0.5"
                        value={formData.silageKg}
                        onChange={(e) => setFormData({ ...formData, silageKg: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-stone-500">Pellets (kg):</span>
                      <input
                        type="number"
                        step="0.5"
                        value={formData.concentrateKg}
                        onChange={(e) => setFormData({ ...formData, concentrateKg: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-stone-500">Fodder (kg):</span>
                      <input
                        type="number"
                        step="0.5"
                        value={formData.greenFodderKg}
                        onChange={(e) => setFormData({ ...formData, greenFodderKg: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-stone-500">Minerals (g):</span>
                      <input
                        type="number"
                        step="10"
                        value={formData.mineralsG}
                        onChange={(e) => setFormData({ ...formData, mineralsG: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Breeder & Health Notes</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="General health, temperament, milking quirks..."
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs"
                >
                  {isAddModalOpen ? 'Register Cattle' : 'Update Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
