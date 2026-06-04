// electron/types.ts

// Основные настройки лаунчера
export interface LauncherSettings {
  gameDir: string;
  javaPath: string;
  maxMemory: number;
  minMemory: number;
  theme: "dark" | "light" | "murflame";
  accentColor: string;
  backgroundOpacity: number;
  sidebarCompact: boolean;
  language: string;
  closeOnLaunch: boolean;
  closeToTray: boolean;
  versionFilter: "all" | "release" | "snapshot" | "old_beta" | "old_alpha";
  customJvmArgs: string;
  windowWidth: number;
  windowHeight: number;
  showSnapshots?: boolean;
}

// Значения по умолчанию
export const DEFAULT_SETTINGS: LauncherSettings = {
  gameDir: "",
  javaPath: "",
  maxMemory: 4096,
  minMemory: 512,
  theme: "murflame",
  accentColor: "#ff6b35",
  backgroundOpacity: 0.85,
  sidebarCompact: false,
  language: "ru",
  closeOnLaunch: false,
  closeToTray: false,
  versionFilter: "all",
  customJvmArgs: "",
  windowWidth: 1200,
  windowHeight: 750,
};

// Типы для аккаунтов
export interface Account {
  id: string;
  type: "microsoft" | "offline" | "ely";
  username: string;
  uuid: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  skinUrl?: string;
  skinHeadUrl?: string;
  skinTextureUrl?: string;
  skinVariant?: "classic" | "slim";
  localSkinPath?: string;
  capeUrl?: string;
}

// Типы для версий
export interface VersionInfo {
  id: string;
  type: string;
  installed: boolean;
}

// Типы для прогресса запуска
export interface LaunchProgress {
  stage: string;
  percent: number;
  message: string;
}

// Типы для Java
export interface JavaInfo {
  path: string;
  version: string;
}

// Типы для инстансов
export interface GameInstance {
  id: string;
  name: string;
  versionId: string;
  mcVersion: string;
  loader: InstanceLoader;
  icon: InstanceIcon;
  notes?: string;
  createdAt: number;
  lastPlayed?: number;
  playTimeMs: number;
}

export type InstanceIcon =
  | "grass"
  | "forge"
  | "fabric"
  | "quilt"
  | "neoforge"
  | "optifine"
  | "diamond"
  | "creeper"
  | "ender"
  | "nether"
  | "custom"
  | "tnt"
  | "star";

// Типы для установки модлоадеров
export interface ModLoaderInstallResult {
  versionId: string;
  warning?: string;
  instance?: GameInstance;
}

export type InstanceLoader = "vanilla" | "fabric" | "forge" | "neoforge" | "quilt" | "optifine";

// Типы для модов
export interface ModrinthProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string;
  downloads: number;
  followers: number;
  author?: string;
  categories?: string[];
  date_modified?: string;
}

export interface ModrinthVersion {
  id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: {
    url: string;
    filename: string;
    primary: boolean;
  }[];
}

export interface CurseForgeProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string;
  downloads: number;
  followers: number;
  author?: string;
  categories?: string[];
  date_modified?: string;
  latest_file_id?: string;
  latest_file_name?: string;
}

export interface CurseForgeVersion {
  id: string;
  name: string;
  file_id: string;
  file_name: string;
  download_url: string;
}

// Интерфейс API для лаунчера
export interface MurFlameAPI {
  settings: {
    get: () => Promise<LauncherSettings>;
    set: (partial: Partial<LauncherSettings>) => Promise<LauncherSettings>;
    pickGameDir: () => Promise<string | null>;
    pickJava: () => Promise<string | null>;
    getMemory: () => Promise<{ minMemory: number; maxMemory: number }>;
  };
  java: {
    list: () => Promise<JavaInfo[]>;
  };
  accounts: {
    list: () => Promise<Account[]>;
    active: () => Promise<Account | null>;
    setActive: (id: string) => Promise<Account | undefined>;
    remove: (id: string) => Promise<Account[]>;
    offline: (username: string) => Promise<Account>;
    microsoftLogin: () => Promise<Account>;
    elyLogin: () => Promise<Account>;
  };
  versions: {
    list: () => Promise<VersionInfo[]>;
    install: (id: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
    last: () => Promise<string>;
  };
  instances: {
    list: () => Promise<GameInstance[]>;
    selected: () => Promise<string | null>;
    setSelected: (id: string | null) => Promise<string | null>;
    installedVersions: () => Promise<string[]>;
    create: (data: {
      name: string;
      versionId: string;
      icon?: InstanceIcon;
      notes?: string;
      loader?: "vanilla" | "fabric" | "forge" | "neoforge" | "quilt";
      withSodiumIris?: boolean;
      withOptifine?: boolean;
    }) => Promise<GameInstance>;
    update: (
      id: string,
      patch: Partial<Omit<GameInstance, "id">
    ) => Promise<GameInstance>;
    updateLoader: (
      id: string,
      newLoader: "vanilla" | "fabric" | "forge" | "neoforge" | "quilt",
      loaderVersion?: string
    ) => Promise<GameInstance>;
    remove: (id: string) => Promise<GameInstance[]>;
    openFolder: (id: string) => Promise<string>;
    launch: (id: string) => Promise<void>;
  };
  modrinth: {
    search: (
      query: string,
      version?: string,
      loader?: string,
      offset?: number,
      limit?: number
    ) => Promise<{ hits: ModrinthProject[]; total_hits: number }>;
    installMod: (projectId: string, instanceId: string) => Promise<boolean>;
  };
  curseforge: {
    search: (
      query: string,
      version?: string,
      loader?: string,
      offset?: number,
      limit?: number
    ) => Promise<{ hits: CurseForgeProject[]; total_hits: number }>;
    installMod: (projectId: string, fileId: string, instanceId: string) => Promise<boolean>;
  };
  mods: {
    listInstalled: (instanceId: string) => Promise<{ files: string[], map: Record<string, string> }>;
    removeMod: (instanceId: string, fileName: string, projectKey?: string) => Promise<boolean>;
  };
  game: {
    launch: (versionId: string, instancePath?: string, loader?: string) => Promise<void>;
    isRunning: () => Promise<boolean>;
    kill: () => Promise<boolean>;
    onStatusChange: (cb: (isRunning: boolean) => void) => () => void;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  shell: {
    open: (url: string) => Promise<void>;
  };
  skin: {
    getAvatar: (accountId: string) => Promise<string>;
    pickFile: () => Promise<string | null>;
    apply: (
      accountId: string,
      filePath: string,
      variant?: "classic" | "slim"
    ) => Promise<Account>;
    reset: (accountId: string) => Promise<Account>;
    sync: (accountId: string) => Promise<Account>;
    previewHead: (filePath: string) => Promise<string>;
    getCapes?: (accountId: string) => Promise<string[]>;
    applyCape?: (accountId: string, filePath: string) => Promise<void>;
    setOfficialCape?: (accountId: string, capeId: string) => Promise<void>;
    resetCape?: (accountId: string) => Promise<void>;
  };
  modloader: {
    list: (
      loader: "fabric" | "quilt" | "forge" | "neoforge",
      mcVersion: string
    ) => Promise<{ id: string; label: string }[]>;
    install: (
      loader: "fabric" | "quilt" | "forge" | "neoforge",
      mcVersion: string,
      options?: {
        loaderVersion?: string;
        withOptifine?: boolean;
        withSodiumIris?: boolean;
      }
    ) => Promise<ModLoaderInstallResult>;
  };
  onLaunchProgress: (cb: (p: LaunchProgress) => void) => () => void;
}
