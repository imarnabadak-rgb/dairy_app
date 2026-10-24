export type BreedType = 'Holstein Friesian' | 'Jersey' | 'Gir' | 'Sahiwal' | 'Brown Swiss' | 'Crossbreed';

export type CowStatus = 'Lactating' | 'Dry' | 'Pregnant' | 'Heifer' | 'Calf' | 'Quarantine';

export type HealthCondition = 'Healthy' | 'Observation' | 'Treatment' | 'Withdrawal';

export interface Cattle {
  id: string;
  tagNumber: string;
  name: string;
  breed: BreedType;
  status: CowStatus;
  healthCondition: HealthCondition;
  dob: string;
  lactationCycle: number;
  lastCalvingDate?: string;
  expectedCalvingDate?: string;
  avgDailyYield: number; // in Liters
  weightKg: number;
  feedRation: {
    silageKg: number;
    concentrateKg: number;
    greenFodderKg: number;
    mineralsG: number;
  };
  activeTreatmentNotes?: string;
  withdrawalEndDate?: string; // milk withdrawal date if on medicine
  damTag?: string; // mother's tag
  sireCode?: string; // father AI code
  notes?: string;
}

export type MilkingSession = 'Morning' | 'Evening';

export type MilkSaleSession = MilkingSession | 'Combined';

export interface MilkSale {
  id: string;
  date: string; // YYYY-MM-DD
  /** Customer selected from Revenue & Customers. */
  buyerId?: string;
  buyerName: string;
  /** Legacy field for sales saved before buyers were linked to customers. */
  centerName?: string;
  session: MilkSaleSession;
  quantityLiters: number;
  clr?: number;
  fatPercentage?: number;
  snfPercentage?: number;
  /** Buyer's base rate used for the quality-based price calculation. */
  baseRate?: number;
  ratePerLiter: number;
  totalAmount: number;
  paymentStatus: 'Paid' | 'Pending';
  notes?: string;
}

export interface MilkLog {
  id: string;
  date: string; // YYYY-MM-DD
  session: MilkingSession;
  cowId: string;
  cowTag: string;
  liters: number;
  fatPercentage: number;
  /** Corrected Lactometer Reading (CLR), used to derive SNF. */
  clr?: number;
  snfPercentage: number;
  qualityStatus: 'Optimal' | 'Standard' | 'Substandard' | 'Discarded';
  isWithheld: boolean; // if true, withheld from human consumption
  milkerName: string;
  notes?: string;
}

export type CustomerType = 'Household' | 'Commercial / Cafe' | 'Retail Store' | 'Dairy Co-op';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  customerType: CustomerType;
  address: string;
  route: string;
  dailyQuotaLiters: number;
  milkType: 'Whole Cow Milk' | 'A2 Desi Milk' | 'Buffalo / High Fat';
  unitPrice: number; // per Liter
  /** Buyer's chart base rate used by the Sales pricing formula. */
  milkBaseRate?: number;
  balanceDue: number;
  preferredSession: 'Morning' | 'Evening' | 'Both';
  status: 'Active' | 'Paused';
}

export type DeliveryStatus = 'Delivered' | 'Pending' | 'Skipped' | 'Partially Delivered';

export interface DailySupplyLog {
  id: string;
  date: string; // YYYY-MM-DD
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  route: string;
  quantityLiters: number;
  unitPrice: number;
  totalAmount: number;
  deliveryStatus: DeliveryStatus;
  paymentStatus: 'Paid' | 'Added to Ledger';
  deliveredAt?: string;
  bottlesReturned: number;
  notes?: string;
}

export interface Invoice {
  id: string;
  customerId: string;
  customerName: string;
  /** Display label for the billing period, e.g. "Oct 1 – Oct 31, 2026". */
  billingMonth: string;
  /** First day of the billing period (YYYY-MM-DD). */
  billingFrom?: string;
  /** Last day of the billing period (YYYY-MM-DD). */
  billingTo?: string;
  totalLiters: number;
  ratePerLiter: number;
  totalAmount: number;
  paidAmount: number;
  status: 'Paid' | 'Pending' | 'Partially Paid' | 'Overdue';
  issueDate: string;
  dueDate: string;
}

export type VaccineStatus = 'Completed' | 'Scheduled' | 'Overdue';

export interface VaccineRecord {
  id: string;
  vaccineName: string;
  targetType: 'Individual' | 'Herd-Wide';
  cattleId?: string;
  cattleTag: string;
  administeredDate: string;
  nextDueDate: string;
  veterinarian: string;
  batchLot: string;
  dosageMl: number;
  status: VaccineStatus;
  requiresMilkWithdrawal: boolean;
  withdrawalDays: number;
  notes?: string;
}

export interface StorageTank {
  id: string;
  name: string;
  capacityLiters: number;
  currentLiters: number;
  tempCelsius: number;
  milkType: string;
  lastSanitized: string;
  status: 'Chilling' | 'Full' | 'Cleaning' | 'Empty';
}

export interface FeedInventory {
  id: string;
  name: string;
  category: 'Forage / Silage' | 'Grain / Concentrate' | 'Dry Fodder' | 'Mineral / Supplement';
  stockKg: number;
  dailyBurnKg: number;
  minThresholdKg: number;
  costPerKg: number;
  supplier: string;
}

export type ExpenseCategory =
  | 'Feed & Fodder'
  | 'Veterinary & Vaccines'
  | 'Labor & Milking Staff'
  | 'Fuel & Equipment'
  | 'Electricity & Cold Storage'
  | 'Cow & Buffalo Purchase'
  | 'Farm Misc & Supplies';

export interface FarmExpense {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: ExpenseCategory;
  amount: number;
  vendor: string;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'Card / UPI';
  receiptNumber?: string;
  notes?: string;
}
