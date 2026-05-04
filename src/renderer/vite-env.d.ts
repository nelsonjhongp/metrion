/// <reference types="vite/client" />

import type { MetrionApi } from "../shared/types";

declare global {
  interface Window {
    metrion: MetrionApi;
  }
}

