import { create } from "zustand";
import type {
  AppContext,
  BusinessUnit,
  ClosingStatus,
  Profile,
  Purchase,
  PurchaseFormValues,
  Supplier,
} from "../../shared/types";

export type PurchaseReturnPage = "control" | "purchases";

export type PurchaseSupplierFlowState = {
  mode: "create" | "edit";
  purchase: Purchase | null;
  returnPage: PurchaseReturnPage;
  supplierId: number | null;
  values: PurchaseFormValues;
  resumeRequested: boolean;
};

type AppState = {
  profiles: Profile[];
  businessUnits: BusinessUnit[];
  profileId: number | null;
  businessUnitId: number | null;
  month: number;
  year: number;
  closingStatus: ClosingStatus;
  purchaseSupplierFlow: PurchaseSupplierFlowState | null;
  setContext: (context: AppContext) => void;
  setProfiles: (profiles: Profile[]) => void;
  addProfile: (profile: Profile) => void;
  removeProfile: (id: number) => void;
  updateProfile: (id: number, name: string) => void;
  setBusinessUnits: (businessUnits: BusinessUnit[]) => void;
  addBusinessUnit: (unit: BusinessUnit) => void;
  updateBusinessUnit: (id: number, name: string) => void;
  removeBusinessUnit: (id: number) => void;
  deactivateBusinessUnit: (id: number) => void;
  setProfileId: (profileId: number | null) => void;
  setBusinessUnitId: (businessUnitId: number | null) => void;
  setPeriod: (month: number, year: number) => void;
  setClosingStatus: (status: ClosingStatus) => void;
  startPurchaseSupplierFlow: (flow: Omit<PurchaseSupplierFlowState, "resumeRequested">) => void;
  markPurchaseSupplierFlowForResume: (supplier: Supplier | null) => void;
  acknowledgePurchaseSupplierFlowResume: () => void;
  clearPurchaseSupplierFlow: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  profiles: [],
  businessUnits: [],
  profileId: null,
  businessUnitId: null,
  month: 5,
  year: 2026,
  closingStatus: "open",
  purchaseSupplierFlow: null,
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
  addProfile: (profile) =>
    set((state) => ({ profiles: [...state.profiles, profile] })),
  removeProfile: (id) =>
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== id),
      profileId: state.profileId === id ? state.profiles.find((p) => p.id !== id)?.id ?? null : state.profileId,
    })),
  updateProfile: (id, name) =>
    set((state) => ({
      profiles: state.profiles.map((p) => (p.id === id ? { ...p, name } : p)),
    })),
  setBusinessUnits: (businessUnits) => set({ businessUnits }),
  addBusinessUnit: (unit) =>
    set((state) => ({ businessUnits: [...state.businessUnits, unit] })),
  updateBusinessUnit: (id, name) =>
    set((state) => ({
      businessUnits: state.businessUnits.map((u) => (u.id === id ? { ...u, name } : u)),
    })),
  removeBusinessUnit: (id) =>
    set((state) => ({
      businessUnits: state.businessUnits.filter((u) => u.id !== id),
      businessUnitId: state.businessUnitId === id
        ? state.businessUnits.find((u) => u.id !== id)?.id ?? null
        : state.businessUnitId,
    })),
  deactivateBusinessUnit: (id) =>
    set((state) => ({
      businessUnits: state.businessUnits.map((u) =>
        u.id === id ? { ...u, isActive: false } : u,
      ),
      businessUnitId: state.businessUnitId === id
        ? state.businessUnits.find((u) => u.id !== id && u.isActive)?.id ?? null
        : state.businessUnitId,
    })),
  setProfileId: (profileId) => set({ profileId }),
  setBusinessUnitId: (businessUnitId) => set({ businessUnitId }),
  setPeriod: (month, year) => set({ month, year }),
  setClosingStatus: (closingStatus) => set({ closingStatus }),
  startPurchaseSupplierFlow: (flow) =>
    set({
      purchaseSupplierFlow: {
        ...flow,
        resumeRequested: false,
      },
    }),
  markPurchaseSupplierFlowForResume: (supplier) =>
    set((state) => {
      if (!state.purchaseSupplierFlow) {
        return state;
      }

      return {
        purchaseSupplierFlow: {
          ...state.purchaseSupplierFlow,
          supplierId: supplier?.id ?? state.purchaseSupplierFlow.supplierId,
          values: supplier ? {
            ...state.purchaseSupplierFlow.values,
            supplierName: supplier.name,
            ruc: supplier.ruc ?? state.purchaseSupplierFlow.values.ruc,
          } : state.purchaseSupplierFlow.values,
          resumeRequested: true,
        },
      };
    }),
  acknowledgePurchaseSupplierFlowResume: () =>
    set((state) => ({
      purchaseSupplierFlow: state.purchaseSupplierFlow
        ? {
            ...state.purchaseSupplierFlow,
            resumeRequested: false,
          }
        : null,
    })),
  clearPurchaseSupplierFlow: () => set({ purchaseSupplierFlow: null }),
}));
