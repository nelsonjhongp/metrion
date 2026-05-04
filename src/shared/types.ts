export type ClosingStatus = "open" | "closed";

export type Profile = {
  id: number;
  name: string;
};

export type BusinessUnit = {
  id: number;
  profileId: number;
  name: string;
  isActive: boolean;
};

export type PeriodSelection = {
  month: number;
  year: number;
};

export type AppContext = {
  profiles: Profile[];
  businessUnits: BusinessUnit[];
  selectedProfileId: number | null;
  selectedBusinessUnitId: number | null;
  period: PeriodSelection;
  closingStatus: ClosingStatus;
};

export type ClosingStatusQuery = {
  profileId: number;
  businessUnitId: number;
  month: number;
  year: number;
};

export type MonthlyClosingQuery = ClosingStatusQuery;

export type MonthlyClosing = {
  id: number;
  profileId: number;
  businessUnitId: number;
  periodMonth: number;
  periodYear: number;
  isClosed: boolean;
  closedAt: string | null;
  reopenedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyClosingChecklist = {
  hasPurchases: boolean;
  hasSales: boolean;
  status: ClosingStatus;
};

export type PurchaseQuery = ClosingStatusQuery;

export type Purchase = {
  id: number;
  profileId: number;
  businessUnitId: number;
  supplierId: number | null;
  periodMonth: number;
  periodYear: number;
  purchaseDate: string;
  ruc: string | null;
  supplierName: string;
  invoiceNumber: string | null;
  amount: number;
  payment: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseInput = PurchaseQuery & {
  purchaseDate: string;
  supplierId?: number | null;
  ruc?: string | null;
  supplierName: string;
  invoiceNumber?: string | null;
  amount: number;
  payment?: string | null;
  note?: string | null;
};

export type PurchaseUpdateInput = PurchaseInput & {
  id: number;
};

export type PurchaseFormValues = {
  purchaseDate: string;
  ruc: string;
  supplierName: string;
  invoiceNumber: string;
  amount: string;
  payment: string;
  note: string;
};

export type MonthlyPurchases = {
  rows: Purchase[];
  totalAmount: number;
};

export type SupplierQuery = {
  profileId: number;
};

export type SupplierLookupQuery = SupplierQuery & {
  ruc: string;
};

export type Supplier = {
  id: number;
  profileId: number;
  ruc: string;
  name: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupplierInput = SupplierQuery & {
  ruc: string;
  name: string;
  note?: string | null;
};

export type SupplierUpdateInput = SupplierInput & {
  id: number;
};

export type SupplierFormValues = {
  ruc: string;
  name: string;
  note: string;
};

export type MonthlySaleQuery = ClosingStatusQuery;

export type MonthlySale = {
  id: number;
  profileId: number;
  businessUnitId: number;
  periodMonth: number;
  periodYear: number;
  totalAmount: number;
  saldoAnterior: number;
  saldoSiguiente: number;
  renta: number;
  igvPago: number;
  baseIgv: number;
  baseIgvManual: number | null;
  nota: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MonthlySaleInput = MonthlySaleQuery & {
  totalAmount: number;
  saldoAnterior?: number | null;
  saldoSiguiente?: number | null;
  renta?: number | null;
  igvPago?: number | null;
  baseIgvManual?: number | null;
  nota?: string | null;
};

export type MonthlySaleFormValues = {
  totalAmount: string;
  saldoAnterior: string;
  saldoSiguiente: string;
  renta: string;
  igvPago: string;
  baseIgv: string;
  nota: string;
};

export type MetrionApi = {
  getContext: () => Promise<AppContext>;
  listProfiles: () => Promise<Profile[]>;
  listBusinessUnits: (profileId: number) => Promise<BusinessUnit[]>;
  getClosingStatus: (query: ClosingStatusQuery) => Promise<ClosingStatus>;
  getClosingChecklist: (
    query: MonthlyClosingQuery,
  ) => Promise<MonthlyClosingChecklist>;
  closeMonth: (query: MonthlyClosingQuery) => Promise<MonthlyClosing>;
  reopenMonth: (query: MonthlyClosingQuery) => Promise<MonthlyClosing>;
  listPurchases: (query: PurchaseQuery) => Promise<MonthlyPurchases>;
  createPurchase: (input: PurchaseInput) => Promise<Purchase>;
  updatePurchase: (input: PurchaseUpdateInput) => Promise<Purchase>;
  deletePurchase: (id: number) => Promise<void>;
  listSuppliers: (query: SupplierQuery) => Promise<Supplier[]>;
  findSupplierByRuc: (query: SupplierLookupQuery) => Promise<Supplier | null>;
  createSupplier: (input: SupplierInput) => Promise<Supplier>;
  updateSupplier: (input: SupplierUpdateInput) => Promise<Supplier>;
  deleteSupplier: (id: number) => Promise<void>;
  getMonthlySale: (query: MonthlySaleQuery) => Promise<MonthlySale | null>;
  saveMonthlySale: (input: MonthlySaleInput) => Promise<MonthlySale>;
};
