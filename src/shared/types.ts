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

export type MetrionApi = {
  getContext: () => Promise<AppContext>;
  listProfiles: () => Promise<Profile[]>;
  listBusinessUnits: (profileId: number) => Promise<BusinessUnit[]>;
  getClosingStatus: (query: ClosingStatusQuery) => Promise<ClosingStatus>;
  listPurchases: (query: PurchaseQuery) => Promise<MonthlyPurchases>;
  createPurchase: (input: PurchaseInput) => Promise<Purchase>;
  updatePurchase: (input: PurchaseUpdateInput) => Promise<Purchase>;
  deletePurchase: (id: number) => Promise<void>;
};
