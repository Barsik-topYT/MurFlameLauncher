import { create } from "zustand";
import type {
  Account,
  LauncherSettings,
  VersionInfo,
  LaunchProgress,
  GameInstance,
} from "../types/api";

type Page = "home" | "accounts" | "skins" | "versions" | "settings" | "mods" | "modpack-import";

interface LauncherState {
  page: Page;
  settings: LauncherSettings | null;
  accounts: Account[];
  activeAccount: Account | null;
  versions: VersionInfo[];
  instances: GameInstance[];
  selectedInstanceId: string | null;
  installedVersions: string[];
  selectedVersion: string;
  progress: LaunchProgress | null;
  loading: boolean;
  error: string | null;
  isDownloading: boolean;
  abortController: AbortController | null;

  setPage: (page: Page) => void;
  loadAll: () => Promise<void>;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<LauncherSettings>) => Promise<void>;
  loadAccounts: () => Promise<void>;
  loadVersions: () => Promise<void>;
  loadInstances: () => Promise<void>;
  setSelectedVersion: (id: string) => void;
  setSelectedInstance: (id: string | null) => void;
  setProgress: (p: LaunchProgress | null) => void;
  setError: (e: string | null) => void;
  startDownload: () => AbortController;
  cancelDownload: () => void;
}

export const useLauncherStore = create<LauncherState>((set, get) => ({
  page: "home",
  settings: null,
  accounts: [],
  activeAccount: null,
  versions: [],
  instances: [],
  selectedInstanceId: null,
  installedVersions: [],
  selectedVersion: "",
  progress: null,
  loading: false,
  error: null,
  isDownloading: false,
  abortController: null,

  setPage: (page) => {
    set({ page, error: null });
    if (page === "versions" && get().versions.length === 0 && window.murflame) {
      void get().loadVersions();
    }
    if (page === "home" && window.murflame) {
      void get().loadInstances();
    }
  },

  loadAll: async () => {
    if (!window.murflame) {
      set({ error: "Запустите приложение через Electron (npm run dev)" });
      return;
    }
    set({ loading: true, error: null });
    try {
      await get().loadSettings();
      await get().loadAccounts();
      await get().loadVersions();
      await get().loadInstances();
      const last = await window.murflame.versions.last();
      const list = get().versions;
      const latest =
        list.find((v) => v.type === "release")?.id || list[0]?.id || "";
      set({ selectedVersion: last || latest });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  loadSettings: async () => {
    const settings = await window.murflame!.settings.get();
    set({ settings });
    applyTheme(settings);
  },

  updateSettings: async (partial) => {
    const settings = await window.murflame!.settings.set(partial);
    set({ settings });
    applyTheme(settings);
  },

  loadAccounts: async () => {
    const accounts = await window.murflame!.accounts.list();
    const activeAccount = await window.murflame!.accounts.active();
    set({ accounts, activeAccount });
  },

  loadVersions: async () => {
    if (!window.murflame) return;
    try {
      const versions = await window.murflame.versions.list();
      if (!versions?.length) {
        set({
          error: "Список версий пуст. Проверьте подключение к интернету.",
          versions: [],
        });
        return;
      }
      set({ versions, error: null });
    } catch (e) {
      set({ error: (e as Error).message, versions: [] });
      throw e;
    }
  },

  loadInstances: async () => {
    if (!window.murflame) return;
    const [instances, selectedInstanceId, installedVersions] = await Promise.all([
      window.murflame.instances.list(),
      window.murflame.instances.selected(),
      window.murflame.instances.installedVersions(),
    ]);
    set({
      instances,
      selectedInstanceId,
      installedVersions,
    });
  },

  setSelectedVersion: (id) => set({ selectedVersion: id }),
  setSelectedInstance: (id) => {
    set({ selectedInstanceId: id });
    if (window.murflame && id) void window.murflame.instances.setSelected(id);
  },
  setProgress: (progress) => {
    if (progress?.stage === "error") {
      set({ progress, error: progress.message });
    } else {
      set({ progress });
    }
  },
  setError: (error) => set({ error }),
  startDownload: () => {
    const controller = new AbortController();
    set({ isDownloading: true, abortController: controller });
    return controller;
  },
  cancelDownload: () => {
    const controller = get().abortController;
    if (controller) {
      controller.abort();
    }
    set({ isDownloading: false, abortController: null, progress: null });
  },
}));

function applyTheme(settings: LauncherSettings) {
  document.documentElement.setAttribute("data-theme", settings.theme);
  const accent = settings.accentColor;
  const root = document.documentElement.style;
  root.setProperty("--user-accent", accent);
  root.setProperty("--accent", accent);
  root.setProperty(
    "--accent-hover",
    `color-mix(in srgb, ${accent} 80%, white)`
  );
  root.setProperty(
    "--accent-glow",
    `color-mix(in srgb, ${accent} 35%, transparent)`
  );
  const opacity = settings.backgroundOpacity;
  root.setProperty(
    "--bg-primary",
    settings.theme === "light"
      ? `color-mix(in srgb, #f4f4f8 ${opacity * 100}%, transparent)`
      : `color-mix(in srgb, #0d0d12 ${opacity * 100}%, transparent)`
  );
}