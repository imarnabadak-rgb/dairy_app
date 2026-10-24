'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  DAIRY_COLLECTIONS,
  dedupeDairyRecords,
  type DairyCollection,
} from '@/lib/dairy/collections';
import {
  deleteDairyRecord,
  fetchAllDairyData,
  insertDairyRecord,
  insertDairyRecords,
  saveDairyCollection,
  type AllDairyData,
  type DataSourceStatus,
} from '@/lib/dairy/client';
import {
  fetchMilkSales,
  insertMilkSale,
  saveMilkSales,
} from '@/lib/sales/client';
import { formatDateRange, parseISODate, todayISO } from '@/lib/date';
import {
  Cattle,
  MilkLog,
  MilkSale,
  Customer,
  DailySupplyLog,
  Invoice,
  VaccineRecord,
  StorageTank,
  FeedInventory,
  FarmExpense,
} from '@/types/dairy';

interface DairyContextType {
  cattle: Cattle[];
  milkLogs: MilkLog[];
  sales: MilkSale[];
  customers: Customer[];
  supplyLogs: DailySupplyLog[];
  invoices: Invoice[];
  vaccines: VaccineRecord[];
  tanks: StorageTank[];
  feeds: FeedInventory[];
  expenses: FarmExpense[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  currencySymbol: string;
  setCurrencySymbol: (s: string) => void;

  // Database status
  syncStatus: DataSourceStatus;
  lastSyncedAt: string | null;
  databaseError: string | null;
  refreshFromDatabase: () => Promise<void>;

  // Cattle actions
  addCattle: (cow: Omit<Cattle, 'id'>) => void;
  updateCattle: (id: string, cow: Partial<Cattle>) => void;
  deleteCattle: (id: string) => void;

  // Milk Production actions
  addMilkLog: (log: Omit<MilkLog, 'id'>) => void;
  updateMilkLog: (id: string, log: Partial<Omit<MilkLog, 'id'>>) => void;
  deleteMilkLog: (id: string) => void;

  // Milk sales to buyers
  addMilkSale: (sale: Omit<MilkSale, 'id'>) => void;
  updateMilkSale: (id: string, sale: Partial<Omit<MilkSale, 'id'>>) => void;
  deleteMilkSale: (id: string) => void;

  // Customer actions
  addCustomer: (cust: Omit<Customer, 'id' | 'balanceDue'>) => void;
  updateCustomer: (id: string, cust: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Supply / Delivery actions
  toggleDeliveryStatus: (id: string, newStatus: DailySupplyLog['deliveryStatus']) => void;
  togglePaymentStatus: (id: string) => void;
  addSupplyLog: (log: Omit<DailySupplyLog, 'id'>) => void;
  updateSupplyLogQuantity: (id: string, newQty: number) => void;
  markAllDeliveriesDelivered: () => void;

  // Invoices & Billing
  recordInvoicePayment: (invoiceId: string, amount: number) => void;
  generateCustomerInvoice: (customerId: string, from: string, to: string) => void;

  // Expenses actions
  addExpense: (exp: Omit<FarmExpense, 'id'>) => void;
  updateExpense: (id: string, updated: Partial<Omit<FarmExpense, 'id'>>) => void;
  deleteExpense: (id: string) => void;

  // Health & Vaccines
  addVaccineRecord: (rec: Omit<VaccineRecord, 'id'>) => void;
  updateVaccineStatus: (id: string, status: VaccineRecord['status']) => void;

  // Feed & Tanks
  updateTankTemp: (id: string, temp: number) => void;
  addFeedStock: (id: string, addedKg: number) => void;

  // Backup & Reset
  exportDataJSON: () => void;
  importDataJSON: (jsonStr: string) => boolean;
  clearFarmData: () => void;
}

const DairyContext = createContext<DairyContextType | undefined>(undefined);

let idSequence = 0;

/**
 * Generates a unique record id. Batch entry inserts several rows in the same
 * tick, where `Date.now()` alone can return the same value for every row.
 */
function makeId(prefix: string): string {
  idSequence += 1;
  return `${prefix}_${Date.now()}_${idSequence.toString(36)}`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Mirrors a collection to the server API shortly after it changes.
 * The small delay collapses bursts of edits (e.g. typing in a quantity field)
 * into a single request.
 */
function useCloudCollection<T extends { id: string }>(
  collection: DairyCollection,
  items: T[],
  cloudReady: boolean,
  skipNextSyncRef: { current: Set<DairyCollection> },
  onSaving: () => void,
  onSynced: () => void,
  onError: (message: string) => void
) {
  useEffect(() => {
    if (!cloudReady) return;

    // Data that was just hydrated from the database does not need to be
    // written straight back.
    if (skipNextSyncRef.current.has(collection)) {
      skipNextSyncRef.current.delete(collection);
      return;
    }

    onSaving();

    const timer = window.setTimeout(() => {
      void saveDairyCollection(collection, items)
        .then(() => onSynced())
        .catch((error: unknown) => {
          console.error(`Could not sync ${collection} to Supabase`, error);
          onError(error instanceof Error ? error.message : String(error));
        });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [collection, items, cloudReady, skipNextSyncRef, onSaving, onSynced, onError]);
}

/**
 * Mirrors the dedicated milk-sales table. Sales use their own API and table,
 * so they are not part of the generic dairy collection sync.
 */
function useCloudSales(
  items: MilkSale[],
  cloudReady: boolean,
  skipNextSyncRef: { current: boolean },
  onSaving: () => void,
  onSynced: () => void,
  onError: (message: string) => void
) {
  useEffect(() => {
    if (!cloudReady) return;

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    onSaving();

    const timer = window.setTimeout(() => {
      void saveMilkSales(items)
        .then(() => onSynced())
        .catch((error: unknown) => {
          console.error('Could not sync milk sales to Supabase', error);
          onError(error instanceof Error ? error.message : String(error));
        });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [items, cloudReady, skipNextSyncRef, onSaving, onSynced, onError]);
}

export const DairyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cloudReady, setCloudReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<DataSourceStatus>('loading');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [currencySymbol, setCurrencySymbol] = useState<string>('₹');

  const [cattle, setCattle] = useState<Cattle[]>([]);
  const [milkLogs, setMilkLogs] = useState<MilkLog[]>([]);
  const [sales, setSales] = useState<MilkSale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [supplyLogs, setSupplyLogs] = useState<DailySupplyLog[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vaccines, setVaccines] = useState<VaccineRecord[]>([]);
  const [tanks, setTanks] = useState<StorageTank[]>([]);
  const [feeds, setFeeds] = useState<FeedInventory[]>([]);
  const [expenses, setExpenses] = useState<FarmExpense[]>([]);

  // Collections that were just read from the database should not be written
  // straight back by the first sync effect.
  const skipNextSyncRef = useRef<Set<DairyCollection>>(new Set());
  const skipNextSalesSyncRef = useRef(true);

  const markSynced = useCallback(() => {
    setLastSyncedAt(new Date().toISOString());
    setSyncStatus('database');
    setDatabaseError(null);
  }, []);

  const markSaving = useCallback(() => {
    setSyncStatus('saving');
    setDatabaseError(null);
  }, []);

  const markSyncError = useCallback((message: string) => {
    setSyncStatus('error');
    setDatabaseError(message);
  }, []);

  const applySalesData = useCallback((records: MilkSale[]) => {
    skipNextSalesSyncRef.current = true;
    setSales(records);
  }, []);

  const applyDatabaseData = useCallback((payload: AllDairyData) => {
    // The database is the only source of truth. Every collection is replaced
    // with exactly what the database returned, including empty collections.
    for (const collection of DAIRY_COLLECTIONS) {
      const records = dedupeDairyRecords(payload.data[collection] ?? []);
      skipNextSyncRef.current.add(collection);

      switch (collection) {
        case 'cattle': setCattle(records as unknown as Cattle[]); break;
        case 'milk_logs': setMilkLogs(records as unknown as MilkLog[]); break;
        case 'customers': setCustomers(records as unknown as Customer[]); break;
        case 'supply_logs': setSupplyLogs(records as unknown as DailySupplyLog[]); break;
        case 'invoices': setInvoices(records as unknown as Invoice[]); break;
        case 'vaccines': setVaccines(records as unknown as VaccineRecord[]); break;
        case 'tanks': setTanks(records as unknown as StorageTank[]); break;
        case 'feeds': setFeeds(records as unknown as FeedInventory[]); break;
        case 'expenses': setExpenses(records as unknown as FarmExpense[]); break;
      }
    }

    setCloudReady(true);
    setSyncStatus('database');
    setLastSyncedAt(payload.fetchedAt);
    setDatabaseError(null);
  }, []);

  // The provider is prerendered on the server, so set the browser's date after
  // mount to avoid a server/client date mismatch.
  useEffect(() => {
    setSelectedDate(todayISO());
  }, []);

  // Hydrate state from the database (through the server API) on mount.
  useEffect(() => {
    let cancelled = false;

    async function loadDatabaseData() {
      try {
        const [payload, salesResult] = await Promise.all([
          fetchAllDairyData(),
          fetchMilkSales()
            .then((records) => ({ records, error: null as unknown }))
            .catch((error: unknown) => ({
              records: [] as MilkSale[],
              error,
            })),
        ]);
        if (cancelled) return;

        applySalesData(salesResult.records);
        applyDatabaseData(payload);

        if (salesResult.error) {
          console.error('Could not load milk sales from Supabase:', salesResult.error);
          setSyncStatus('error');
          setDatabaseError(
            `Milk sales could not be loaded: ${errorMessage(
              salesResult.error,
              'Unknown database error'
            )}`
          );
        }
      } catch (error) {
        if (cancelled) return;

        console.error('Could not load farm data from Supabase:', error);
        setSyncStatus('error');
        setDatabaseError(errorMessage(error, 'Unknown database error'));
        setCloudReady(false);
      }
    }

    void loadDatabaseData();
    return () => { cancelled = true; };
  }, [applyDatabaseData, applySalesData]);

  const refreshFromDatabase = useCallback(async () => {
    setSyncStatus('loading');
    setDatabaseError(null);

    try {
      const [payload, salesResult] = await Promise.all([
        fetchAllDairyData(),
        fetchMilkSales()
          .then((records) => ({ records, error: null as unknown }))
          .catch((error: unknown) => ({
            records: [] as MilkSale[],
            error,
          })),
      ]);

      applySalesData(salesResult.records);
      applyDatabaseData(payload);

      if (salesResult.error) {
        console.error('Could not load milk sales from Supabase:', salesResult.error);
        setSyncStatus('error');
        setDatabaseError(
          `Milk sales could not be loaded: ${errorMessage(
            salesResult.error,
            'Unknown database error'
          )}`
        );
      }
    } catch (error) {
      console.error('Could not refresh farm data from Supabase:', error);
      setSyncStatus('error');
      setDatabaseError(errorMessage(error, 'Unknown database error'));
      setCloudReady(false);
    }
  }, [applyDatabaseData, applySalesData]);

  // Push each collection to the database once the initial load has finished.
  useCloudCollection('cattle', cattle, cloudReady, skipNextSyncRef, markSaving, markSynced, markSyncError);
  useCloudCollection('milk_logs', milkLogs, cloudReady, skipNextSyncRef, markSaving, markSynced, markSyncError);
  useCloudSales(sales, cloudReady, skipNextSalesSyncRef, markSaving, markSynced, markSyncError);
  useCloudCollection('customers', customers, cloudReady, skipNextSyncRef, markSaving, markSynced, markSyncError);
  useCloudCollection('supply_logs', supplyLogs, cloudReady, skipNextSyncRef, markSaving, markSynced, markSyncError);
  useCloudCollection('invoices', invoices, cloudReady, skipNextSyncRef, markSaving, markSynced, markSyncError);
  useCloudCollection('vaccines', vaccines, cloudReady, skipNextSyncRef, markSaving, markSynced, markSyncError);
  useCloudCollection('tanks', tanks, cloudReady, skipNextSyncRef, markSaving, markSynced, markSyncError);
  useCloudCollection('feeds', feeds, cloudReady, skipNextSyncRef, markSaving, markSynced, markSyncError);
  useCloudCollection('expenses', expenses, cloudReady, skipNextSyncRef, markSaving, markSynced, markSyncError);

  const addCattle = (newCow: Omit<Cattle, 'id'>) => {
    const record: Cattle = { ...newCow, id: makeId('c') };
    setCattle((prev) => [record, ...prev]);

    // Explicit INSERT for the form entry. The debounced collection sync also
    // runs as a safety net.
    void insertDairyRecord('cattle', record).catch((error) => {
      console.error('Could not insert cattle directly; the collection sync will retry.', error);
    });
  };

  const updateCattle = (id: string, updated: Partial<Cattle>) => {
    setCattle((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
  };

  const deleteCattle = (id: string) => {
    setCattle((prev) => prev.filter((c) => c.id !== id));

    // Delete the row immediately instead of waiting for the debounced collection
    // sync. The sync still runs as a safety net if this request fails.
    void deleteDairyRecord('cattle', id).catch((error) => {
      console.error(
        'Could not delete cattle directly; the collection sync will retry.',
        error
      );
    });
  };

  const addMilkLog = (log: Omit<MilkLog, 'id'>) => {
    const record: MilkLog = { ...log, id: makeId('ml') };
    setMilkLogs((prev) => [record, ...prev]);

    void insertDairyRecord('milk_logs', record).catch((error) => {
      console.error('Could not insert milk log directly; the collection sync will retry.', error);
    });

    if (!log.isWithheld && log.qualityStatus !== 'Discarded') {
      setTanks((prev) =>
        prev.map((t, idx) =>
          idx === 0
            ? { ...t, currentLiters: Math.min(t.capacityLiters, Number((t.currentLiters + log.liters).toFixed(1))) }
            : t
        )
      );
    }
  };

  const updateMilkLog = (id: string, updated: Partial<Omit<MilkLog, 'id'>>) => {
    const existing = milkLogs.find((log) => log.id === id);
    if (!existing) return;

    const nextLog = { ...existing, ...updated };
    setMilkLogs((prev) => prev.map((log) => (log.id === id ? nextLog : log)));

    // Keep the first bulk tank aligned with any change to usable liters.
    const wasUsable = !existing.isWithheld && existing.qualityStatus !== 'Discarded';
    const isUsable = !nextLog.isWithheld && nextLog.qualityStatus !== 'Discarded';
    const delta =
      (isUsable ? Number(nextLog.liters) : 0) -
      (wasUsable ? Number(existing.liters) : 0);

    if (delta !== 0) {
      setTanks((prev) =>
        prev.map((t, idx) =>
          idx === 0
            ? {
                ...t,
                currentLiters: Math.max(
                  0,
                  Math.min(
                    t.capacityLiters,
                    Number((t.currentLiters + delta).toFixed(1))
                  )
                ),
              }
            : t
        )
      );
    }
  };

  const deleteMilkLog = (id: string) => {
    const log = milkLogs.find((m) => m.id === id);
    setMilkLogs((prev) => prev.filter((m) => m.id !== id));

    // Delete the row immediately instead of waiting for the debounced collection
    // sync. The sync still runs as a safety net if this request fails.
    void deleteDairyRecord('milk_logs', id).catch((error) => {
      console.error(
        'Could not delete milk log directly; the collection sync will retry.',
        error
      );
    });

    // Keep the bulk-tank total in sync when a usable log is removed.
    if (log && !log.isWithheld && log.qualityStatus !== 'Discarded') {
      setTanks((prev) =>
        prev.map((t, idx) =>
          idx === 0
            ? {
                ...t,
                currentLiters: Math.max(
                  0,
                  Number((t.currentLiters - log.liters).toFixed(1))
                ),
              }
            : t
        )
      );
    }
  };

  const adjustFirstTank = (delta: number) => {
    if (!delta) return;
    setTanks((prev) =>
      prev.map((t, idx) =>
        idx === 0
          ? {
              ...t,
              currentLiters: Math.max(
                0,
                Math.min(
                  t.capacityLiters,
                  Number((t.currentLiters + delta).toFixed(1))
                )
              ),
            }
          : t
      )
    );
  };

  const addMilkSale = (sale: Omit<MilkSale, 'id'>) => {
    const record: MilkSale = { ...sale, id: makeId('sale') };
    setSales((prev) => [record, ...prev]);

    void insertMilkSale(record).catch((error) => {
      console.error('Could not insert milk sale directly; the collection sync will retry.', error);
    });

    // Milk sold to a buyer leaves the bulk tank.
    adjustFirstTank(-Number(record.quantityLiters));
  };

  const updateMilkSale = (id: string, updated: Partial<Omit<MilkSale, 'id'>>) => {
    const existing = sales.find((sale) => sale.id === id);
    if (!existing) return;

    const quantityLiters = Number(updated.quantityLiters ?? existing.quantityLiters);
    const ratePerLiter = Number(updated.ratePerLiter ?? existing.ratePerLiter);
    const nextSale: MilkSale = {
      ...existing,
      ...updated,
      quantityLiters,
      ratePerLiter,
      totalAmount: Number((quantityLiters * ratePerLiter).toFixed(2)),
    };

    setSales((prev) => prev.map((sale) => (sale.id === id ? nextSale : sale)));
    adjustFirstTank(Number(existing.quantityLiters) - quantityLiters);
  };

  const deleteMilkSale = (id: string) => {
    const existing = sales.find((sale) => sale.id === id);
    setSales((prev) => prev.filter((sale) => sale.id !== id));
    if (existing) adjustFirstTank(Number(existing.quantityLiters));
  };

  const addCustomer = (cust: Omit<Customer, 'id' | 'balanceDue'>) => {
    const id = makeId('cust');
    const newCust: Customer = {
      ...cust,
      id,
      balanceDue: 0,
    };
    setCustomers((prev) => [newCust, ...prev]);

    const supplyLog: DailySupplyLog = {
      id: makeId('del'),
      date: selectedDate || todayISO(),
      customerId: id,
      customerName: cust.name,
      customerType: cust.customerType,
      route: cust.route,
      quantityLiters: cust.dailyQuotaLiters,
      unitPrice: cust.unitPrice,
      totalAmount: Number((cust.dailyQuotaLiters * cust.unitPrice).toFixed(2)),
      deliveryStatus: 'Pending',
      paymentStatus: 'Added to Ledger',
      bottlesReturned: 0,
    };
    setSupplyLogs((prev) => [supplyLog, ...prev]);

    void insertDairyRecords([
      { collection: 'customers', ...newCust },
      { collection: 'supply_logs', ...supplyLog },
    ]).catch((error) => {
      console.error('Could not insert customer directly; the collection sync will retry.', error);
    });
  };

  const updateCustomer = (id: string, updated: Partial<Customer>) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
  };

  const deleteCustomer = (id: string) => {
    const relatedSupplyLogs = supplyLogs.filter((log) => log.customerId === id);
    const relatedInvoices = invoices.filter((invoice) => invoice.customerId === id);

    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setSupplyLogs((prev) => prev.filter((log) => log.customerId !== id));
    setInvoices((prev) => prev.filter((invoice) => invoice.customerId !== id));

    // Immediate deletes make removal permanent even if the user reloads before
    // the debounced collection sync runs. The sync still runs as a fallback.
    void deleteDairyRecord('customers', id).catch((error) => {
      console.error(
        'Could not delete customer directly; the collection sync will retry.',
        error
      );
    });

    for (const log of relatedSupplyLogs) {
      void deleteDairyRecord('supply_logs', log.id).catch((error) => {
        console.error(
          'Could not delete customer delivery log directly; the collection sync will retry.',
          error
        );
      });
    }

    for (const invoice of relatedInvoices) {
      void deleteDairyRecord('invoices', invoice.id).catch((error) => {
        console.error(
          'Could not delete customer invoice directly; the collection sync will retry.',
          error
        );
      });
    }
  };

  const toggleDeliveryStatus = (id: string, newStatus: DailySupplyLog['deliveryStatus']) => {
    setSupplyLogs((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const now = new Date();
          const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(
            now.getMinutes()
          ).padStart(2, '0')}`;
          return {
            ...item,
            deliveryStatus: newStatus,
            deliveredAt: newStatus === 'Delivered' ? timeString : item.deliveredAt,
          };
        }
        return item;
      })
    );
  };

  const togglePaymentStatus = (id: string) => {
    const supplyLog = supplyLogs.find((item) => item.id === id);
    if (!supplyLog) return;

    const nextState = supplyLog.paymentStatus === 'Paid' ? 'Added to Ledger' : 'Paid';
    const balanceAdjustment = nextState === 'Paid' ? -supplyLog.totalAmount : supplyLog.totalAmount;

    setSupplyLogs((prev) =>
      prev.map((item) => (item.id === id ? { ...item, paymentStatus: nextState } : item))
    );
    setCustomers((prev) =>
      prev.map((customer) =>
        customer.id === supplyLog.customerId
          ? {
              ...customer,
              balanceDue: Math.max(
                0,
                Number((customer.balanceDue + balanceAdjustment).toFixed(2))
              ),
            }
          : customer
      )
    );
  };

  const addSupplyLog = (log: Omit<DailySupplyLog, 'id'>) => {
    const record: DailySupplyLog = { ...log, id: makeId('del') };
    setSupplyLogs((prev) => [record, ...prev]);

    void insertDairyRecord('supply_logs', record).catch((error) => {
      console.error('Could not insert supply log directly; the collection sync will retry.', error);
    });
  };

  const updateSupplyLogQuantity = (id: string, newQty: number) => {
    setSupplyLogs((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const total = Number((newQty * item.unitPrice).toFixed(2));
          return {
            ...item,
            quantityLiters: newQty,
            totalAmount: total,
          };
        }
        return item;
      })
    );
  };

  const markAllDeliveriesDelivered = () => {
    const now = new Date();
    const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setSupplyLogs((prev) =>
      prev.map((item) =>
        item.date === selectedDate && item.deliveryStatus === 'Pending'
          ? { ...item, deliveryStatus: 'Delivered', deliveredAt: timeString }
          : item
      )
    );
  };

  const recordInvoicePayment = (invoiceId: string, amount: number) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          const newPaid = Number((inv.paidAmount + amount).toFixed(2));
          const newStatus = newPaid >= inv.totalAmount ? 'Paid' : 'Partially Paid';
          return { ...inv, paidAmount: newPaid, status: newStatus };
        }
        return inv;
      })
    );
  };

  const generateCustomerInvoice = (customerId: string, from: string, to: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;

    const fromDate = parseISODate(from);
    const toDate = parseISODate(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return;
    if (fromDate > toDate) return;

    // Inclusive day count for the selected billing period.
    const dayCount =
      Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
    const approxLiters = Number((cust.dailyQuotaLiters * dayCount).toFixed(2));
    const total = Number((approxLiters * cust.unitPrice).toFixed(2));
    const issueDate = selectedDate || todayISO();
    const dueDate = new Date(`${issueDate}T00:00:00Z`);
    dueDate.setUTCDate(dueDate.getUTCDate() + 30);

    const newInv: Invoice = {
      id: makeId('INV'),
      customerId: cust.id,
      customerName: cust.name,
      billingMonth: formatDateRange(from, to),
      billingFrom: from,
      billingTo: to,
      totalLiters: approxLiters,
      ratePerLiter: cust.unitPrice,
      totalAmount: total,
      paidAmount: 0,
      status: 'Pending',
      issueDate,
      dueDate: dueDate.toISOString().slice(0, 10),
    };
    setInvoices((prev) => [newInv, ...prev]);

    void insertDairyRecord('invoices', newInv).catch((error) => {
      console.error('Could not insert invoice directly; the collection sync will retry.', error);
    });
  };

  const addVaccineRecord = (rec: Omit<VaccineRecord, 'id'>) => {
    const record: VaccineRecord = { ...rec, id: makeId('vac') };
    setVaccines((prev) => [record, ...prev]);

    void insertDairyRecord('vaccines', record).catch((error) => {
      console.error('Could not insert vaccine directly; the collection sync will retry.', error);
    });

    if (rec.requiresMilkWithdrawal && rec.cattleId) {
      const withdrawalDays = rec.withdrawalDays || 3;
      const today = new Date();
      today.setDate(today.getDate() + withdrawalDays);
      const endDate = today.toISOString().split('T')[0];

      updateCattle(rec.cattleId, {
        healthCondition: 'Withdrawal',
        withdrawalEndDate: endDate,
        activeTreatmentNotes: `${rec.vaccineName} administered. Milk withdrawal for ${withdrawalDays} days.`,
      });
    }
  };

  const updateVaccineStatus = (id: string, status: VaccineRecord['status']) => {
    setVaccines((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
  };

  const updateTankTemp = (id: string, temp: number) => {
    setTanks((prev) => prev.map((t) => (t.id === id ? { ...t, tempCelsius: temp } : t)));
  };

  const addFeedStock = (id: string, addedKg: number) => {
    setFeeds((prev) =>
      prev.map((f) => (f.id === id ? { ...f, stockKg: f.stockKg + addedKg } : f))
    );
  };

  const addExpense = (exp: Omit<FarmExpense, 'id'>) => {
    const record: FarmExpense = { ...exp, id: makeId('exp') };
    setExpenses((prev) => [record, ...prev]);

    void insertDairyRecord('expenses', record).catch((error) => {
      console.error('Could not insert expense directly; the collection sync will retry.', error);
    });
  };

  const updateExpense = (
    id: string,
    updated: Partial<Omit<FarmExpense, 'id'>>
  ) => {
    setExpenses((prev) =>
      prev.map((expense) =>
        expense.id === id ? { ...expense, ...updated } : expense
      )
    );
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const exportDataJSON = () => {
    const data = {
      cattle,
      milkLogs,
      sales,
      customers,
      supplyLogs,
      invoices,
      vaccines,
      tanks,
      feeds,
      expenses,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dairyflow_backup_${selectedDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDataJSON = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.cattle) setCattle(parsed.cattle);
      if (parsed.milkLogs) setMilkLogs(parsed.milkLogs);
      if (parsed.sales) setSales(parsed.sales);
      if (parsed.customers) setCustomers(parsed.customers);
      if (parsed.supplyLogs) setSupplyLogs(parsed.supplyLogs);
      if (parsed.invoices) setInvoices(parsed.invoices);
      if (parsed.vaccines) setVaccines(parsed.vaccines);
      if (parsed.tanks) setTanks(parsed.tanks);
      if (parsed.feeds) setFeeds(parsed.feeds);
      if (parsed.expenses) setExpenses(parsed.expenses);
      return true;
    } catch (e) {
      console.error('Failed to import JSON', e);
      return false;
    }
  };

  const clearFarmData = () => {
    setCattle([]);
    setMilkLogs([]);
    setSales([]);
    setCustomers([]);
    setSupplyLogs([]);
    setInvoices([]);
    setVaccines([]);
    setTanks([]);
    setFeeds([]);
    setExpenses([]);
  };

  return (
    <DairyContext.Provider
      value={{
        cattle,
        milkLogs,
        sales,
        customers,
        supplyLogs,
        invoices,
        vaccines,
        tanks,
        feeds,
        expenses,
        selectedDate,
        setSelectedDate,
        currencySymbol,
        setCurrencySymbol,
        syncStatus,
        lastSyncedAt,
        databaseError,
        refreshFromDatabase,
        addCattle,
        updateCattle,
        deleteCattle,
        addMilkLog,
        updateMilkLog,
        deleteMilkLog,
        addMilkSale,
        updateMilkSale,
        deleteMilkSale,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        toggleDeliveryStatus,
        togglePaymentStatus,
        addSupplyLog,
        updateSupplyLogQuantity,
        markAllDeliveriesDelivered,
        recordInvoicePayment,
        generateCustomerInvoice,
        addExpense,
        updateExpense,
        deleteExpense,
        addVaccineRecord,
        updateVaccineStatus,
        updateTankTemp,
        addFeedStock,
        exportDataJSON,
        importDataJSON,
        clearFarmData,
      }}
    >
      {children}
    </DairyContext.Provider>
  );
};

export const useDairy = () => {
  const context = useContext(DairyContext);
  if (!context) {
    throw new Error('useDairy must be used within a DairyProvider');
  }
  return context;
};
