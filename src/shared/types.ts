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

export type MetrionApi = {
  getContext: () => Promise<AppContext>;
  listProfiles: () => Promise<Profile[]>;
  listBusinessUnits: (profileId: number) => Promise<BusinessUnit[]>;
  getClosingStatus: (query: ClosingStatusQuery) => Promise<ClosingStatus>;
};

