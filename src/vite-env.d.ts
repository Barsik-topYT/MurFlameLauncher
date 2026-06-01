/// <reference types="vite/client" />

import type { MurFlameAPI } from "./types/api";

declare global {
  interface Window {
    murflame?: MurFlameAPI;
  }
}

export interface LauncherSettings {
  gameDir: string;
  javaPath: string;
  maxMemory: number;
  minMemory: number;
  theme: "dark" | "light" | "murflame";
  accentColor: string;
  backgroundOpacity: number;
  sidebarCompact: boolean;
  language: "ru" | "en";
  closeOnLaunch: boolean;
  showSnapshots?: boolean;
  versionFilter: "all" | "release" | "snapshot" | "old_beta" | "old_alpha";
  customJvmArgs: string;
  windowWidth: number;
  windowHeight: number;
}

export interface Account {
  id: string;
  type: "microsoft" | "offline";
  username: string;
  uuid?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  skinUrl?: string;
  skinHeadUrl?: string;
  skinTextureUrl?: string;
  localSkinPath?: string;
  skinVariant?: "classic" | "slim";
}

export interface VersionInfo {
  id: string;
  type: string;
  installed: boolean;
}

export type InstanceLoader =
  | "vanilla"
  | "forge"
  | "fabric"
  | "quilt"
  | "neoforge"
  | "optifine";

export type InstanceIcon =
  | "grass"
  | "forge"
  | "fabric"
  | "quilt"
  | "neoforge"
  | "optifine"
  | "diamond"
  | "tnt"
  | "star";

export interface GameInstance {
  id: string;
  name: string;
  versionId: string;
  mcVersion: string;
  loader: InstanceLoader;
  icon: InstanceIcon;
  createdAt: number;
  lastPlayed?: number;
  playTimeMs: number;
  notes?: string;
}

export interface ModLoaderInstallResult {
  versionId: string;
  warning?: string;
  instance?: GameInstance;
}

export interface LaunchProgress {
  stage: string;
  percent: number;
  message: string;
}
