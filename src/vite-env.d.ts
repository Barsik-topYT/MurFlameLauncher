/// <reference types="vite/client" />

import type { MurFlameAPI } from "./types/api";

declare global {
  interface Window {
    murflame?: MurFlameAPI;
  }
}

