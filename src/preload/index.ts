import { contextBridge, ipcRenderer } from "electron";
import type { ClosingStatusQuery, MetrionApi } from "../shared/types";

const api: MetrionApi = {
  getContext: () => ipcRenderer.invoke("app:getContext"),
  listProfiles: () => ipcRenderer.invoke("profiles:list"),
  listBusinessUnits: (profileId: number) =>
    ipcRenderer.invoke("businessUnits:list", profileId),
  getClosingStatus: (query: ClosingStatusQuery) =>
    ipcRenderer.invoke("closings:getStatus", query),
};

contextBridge.exposeInMainWorld("metrion", api);

