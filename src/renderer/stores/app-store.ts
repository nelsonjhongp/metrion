import { create } from "zustand";
import type {
  AppContext,
  BusinessUnit,
  ClosingStatus,
  Profile,
} from "../../shared/types";

type AppState = {
  profiles: Profile[];
  businessUnits: BusinessUnit[];
  profileId: number | null;
  businessUnitId: number | null;
  month: number;
  year: number;
  closingStatus: ClosingStatus;
  setContext: (context: AppContext) => void;
  setProfiles: (profiles: Profile[]) => void;
  setBusinessUnits: (businessUnits: BusinessUnit[]) => void;
  setProfileId: (profileId: number | null) => void;
  setBusinessUnitId: (businessUnitId: number | null) => void;
  setPeriod: (month: number, year: number) => void;
  setClosingStatus: (status: ClosingStatus) => void;
};

export const useAppStore = create<AppState>((set) => ({
  profiles: [],
  businessUnits: [],
  profileId: null,
  businessUnitId: null,
  month: 5,
  year: 2026,
  closingStatus: "open",
  setContext: (context) =>
    set({
      profiles: context.profiles,
      businessUnits: context.businessUnits,
      profileId: context.selectedProfileId,
      businessUnitId: context.selectedBusinessUnitId,
      month: context.period.month,
      year: context.period.year,
      closingStatus: context.closingStatus,
    }),
  setProfiles: (profiles) => set({ profiles }),
  setBusinessUnits: (businessUnits) => set({ businessUnits }),
  setProfileId: (profileId) => set({ profileId }),
  setBusinessUnitId: (businessUnitId) => set({ businessUnitId }),
  setPeriod: (month, year) => set({ month, year }),
  setClosingStatus: (closingStatus) => set({ closingStatus }),
}));

