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
  ruc: string | null;
  name: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupplierInput = SupplierQuery & {
  ruc?: string | null;
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

export type SupplierDirectoryStatus = "cataloged" | "pending";

export type SupplierDirectoryEntry = {
  entryKey: string;
  status: SupplierDirectoryStatus;
  supplierId: number | null;
  ruc: string | null;
  name: string;
  note: string | null;
  purchaseCount: number;
  lastPurchaseDate: string | null;
  aliases: string[];
};

export type SupplierDirectoryQuery = SupplierQuery;

export type SupplierNormalizationSweepResult = {
  mergedCatalogSuppliers: number;
  linkedPurchases: number;
  pendingEntries: number;
  similarGroups: Array<{
    canonicalName: string;
    variants: string[];
  }>;
};

export type ResolveSupplierDirectoryEntryInput = SupplierQuery & {
  entryKey: string;
  targetSupplierId?: number | null;
  supplier?: {
    ruc?: string | null;
    name: string;
    note?: string | null;
  };
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

export type ExportMonthlyXlsxQuery = ClosingStatusQuery & {
  unitName: string;
  monthName: string;
};

export type ExportMonthlyXlsxResult = {
  success: boolean;
  filePath?: string;
  error?: string;
};

export type MonthlyPeriodsQuery = {
  profileId: number;
  businessUnitId: number;
};

export type DashboardQuery = ClosingStatusQuery;

export type MonthlyPeriodSummary = {
  month: number;
  year: number;
  totalPurchases: number;
  purchaseCount: number;
  totalSales: number;
  totalPagar: number;
  isClosed: boolean;
};

export type DashboardSeriesPoint = {
  month: number;
  year: number;
  label: string;
  totalPurchases: number;
  totalSales: number;
  totalPagar: number;
  purchaseCount: number;
  isClosed: boolean;
};

export type DashboardCurrentSnapshot = {
  month: number;
  year: number;
  totalPurchases: number;
  totalSales: number;
  totalPagar: number;
  purchaseCount: number;
  difference: number;
  isClosed: boolean;
};

export type DashboardMetricComparison = {
  hasComparison: boolean;
  previousValue: number | null;
  delta: number | null;
  deltaPercent: number | null;
  previousLabel: string | null;
};

export type DashboardComparisons = {
  totalPurchases: DashboardMetricComparison;
  totalSales: DashboardMetricComparison;
  totalPagar: DashboardMetricComparison;
  difference: DashboardMetricComparison;
};

export type DashboardYearOverview = {
  trackedMonths: number;
  closedMonths: number;
  openMonths: number;
  monthsWithPurchasesNoSales: number;
  monthsWithSalesPendingClose: number;
};

export type DashboardSupplierRankingItem = {
  supplierKey: string;
  supplierName: string;
  ruc: string | null;
  totalAmount: number;
  purchaseCount: number;
  share: number;
};

export type DashboardData = {
  current: DashboardCurrentSnapshot;
  comparisons: DashboardComparisons;
  series: DashboardSeriesPoint[];
  yearOverview: DashboardYearOverview;
  topSuppliers: DashboardSupplierRankingItem[];
};

export type ExportYearlyXlsxQuery = {
  profileId: number;
  businessUnitId: number;
  year: number;
  unitName: string;
};

export type BackupSelectionUnit = {
  businessUnitId: number;
  name: string;
  selected: boolean;
};

export type BackupSelectionProfile = {
  profileId: number;
  name: string;
  selected: boolean;
  units: BackupSelectionUnit[];
};

export type ExportBackupPreview = {
  profiles: BackupSelectionProfile[];
  totalProfiles: number;
  totalUnits: number;
};

export type ExportBackupFileQuery = {
  profiles: Array<{
    profileId: number;
    businessUnitIds: number[];
  }>;
};

export type ExportBackupFileResult = {
  success: boolean;
  filePath?: string;
  exportedProfiles?: number;
  exportedUnits?: number;
  error?: string;
};

export type BackupImportUnitImpact = {
  unitName: string;
  suppliers: number;
  purchasesNew: number;
  purchasesExisting: number;
  salesNew: number;
  salesUpdates: number;
  closingsNew: number;
  closingsUpdates: number;
};

export type BackupImportProfileImpact = {
  profileName: string;
  willCreateProfile: boolean;
  units: BackupImportUnitImpact[];
};

export type ImportBackupPreview = {
  sessionId: string;
  fileName: string;
  version: number;
  mode: "merge";
  profiles: BackupImportProfileImpact[];
  totals: {
    profilesCreate: number;
    unitsCreate: number;
    suppliersDetected: number;
    purchasesNew: number;
    purchasesExisting: number;
    salesNew: number;
    salesUpdates: number;
    closingsNew: number;
    closingsUpdates: number;
  };
  warnings: string[];
};

export type ImportBackupApplyQuery = {
  sessionId: string;
};

export type ImportBackupApplyResult = {
  success: boolean;
  created: {
    profiles: number;
    units: number;
    suppliers: number;
    purchases: number;
    sales: number;
    closings: number;
  };
  updated: {
    sales: number;
    closings: number;
  };
  errors: string[];
};

export type ImportPreviewQuery = {
  profileId: number;
  businessUnitId: number;
};

export type ImportMonthPreview = {
  month: number;
  year: number;
  monthName: string;
  purchaseCount: number;
  totalPurchases: number;
  totalSales: number;
};

export type ImportPreview = {
  sessionId: string;
  fileName: string;
  unitName: string;
  months: ImportMonthPreview[];
  totalPurchases: number;
  totalMonths: number;
  warnings: string[];
};

export type ImportApplyQuery = {
  sessionId: string;
  profileId: number;
  businessUnitId: number;
  selectedMonths: Array<{ month: number; year: number }>;
};

export type ImportApplyResult = {
  success: boolean;
  inserted: { purchases: number; sales: number; suppliers: number };
  errors: string[];
};

export type ProfileInput = {
  name: string;
};

export type ProfileUpdateInput = {
  id: number;
  name: string;
};

export type BusinessUnitInput = {
  profileId: number;
  name: string;
};

export type BusinessUnitUpdateInput = {
  id: number;
  name: string;
};

export type MetrionApi = {
  getContext: (preferredProfileId?: number) => Promise<AppContext>;
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
  listSupplierDirectory: (query: SupplierDirectoryQuery) => Promise<SupplierDirectoryEntry[]>;
  runSupplierNormalizationSweep: (query: SupplierQuery) => Promise<SupplierNormalizationSweepResult>;
  findSupplierByRuc: (query: SupplierLookupQuery) => Promise<Supplier | null>;
  createSupplier: (input: SupplierInput) => Promise<Supplier>;
  updateSupplier: (input: SupplierUpdateInput) => Promise<Supplier>;
  deleteSupplier: (id: number) => Promise<void>;
  resolveSupplierDirectoryEntry: (input: ResolveSupplierDirectoryEntryInput) => Promise<Supplier>;
  getMonthlySale: (query: MonthlySaleQuery) => Promise<MonthlySale | null>;
  saveMonthlySale: (input: MonthlySaleInput) => Promise<MonthlySale>;
  exportMonthlyXlsx: (query: ExportMonthlyXlsxQuery) => Promise<ExportMonthlyXlsxResult>;
  exportYearlyXlsx: (query: ExportYearlyXlsxQuery) => Promise<ExportMonthlyXlsxResult>;
  exportBackupPreview: () => Promise<ExportBackupPreview>;
  exportBackupFile: (query: ExportBackupFileQuery) => Promise<ExportBackupFileResult>;
  importPreview: (query: ImportPreviewQuery) => Promise<ImportPreview>;
  importApply: (query: ImportApplyQuery) => Promise<ImportApplyResult>;
  importBackupPreview: () => Promise<ImportBackupPreview>;
  importBackupApply: (query: ImportBackupApplyQuery) => Promise<ImportBackupApplyResult>;
  createProfile: (input: ProfileInput) => Promise<Profile>;
  updateProfile: (input: ProfileUpdateInput) => Promise<Profile>;
  deleteProfile: (id: number) => Promise<void>;
  createBusinessUnit: (input: BusinessUnitInput) => Promise<BusinessUnit>;
  updateBusinessUnit: (input: BusinessUnitUpdateInput) => Promise<BusinessUnit>;
  deleteBusinessUnit: (id: number) => Promise<void>;
  deactivateBusinessUnit: (id: number) => Promise<void>;
  enterApp: (profileId: number) => Promise<void>;
  logoutApp: () => Promise<void>;
  listMonthlyPeriods: (query: MonthlyPeriodsQuery) => Promise<MonthlyPeriodSummary[]>;
  getDashboardData: (query: DashboardQuery) => Promise<DashboardData>;
};
