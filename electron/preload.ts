import { contextBridge, ipcRenderer } from "electron";
import type {
  LauncherSettings,
  Account,
  VersionInfo,
  LaunchProgress,
  JavaInfo,
  GameInstance,
  InstanceIcon,
  ModLoaderInstallResult,
  ModrinthProject,
  CurseForgeProject,
} from "./types.js";

const api = {
  settings: {
    get: (): Promise<LauncherSettings> => ipcRenderer.invoke("settings:get"),
    set: (partial: Partial<LauncherSettings>): Promise<LauncherSettings> =>
      ipcRenderer.invoke("settings:set", partial),
    pickGameDir: (): Promise<string | null> =>
      ipcRenderer.invoke("settings:pickGameDir"),
    pickJava: (): Promise<string | null> =>
      ipcRenderer.invoke("settings:pickJava"),
    getMemory: (): Promise<{ minMemory: number; maxMemory: number }> =>
      ipcRenderer.invoke("settings:getMemory"),
  },
  java: {
    list: (): Promise<JavaInfo[]> => ipcRenderer.invoke("java:list"),
  },
  accounts: {
    list: (): Promise<Account[]> => ipcRenderer.invoke("accounts:list"),
    active: (): Promise<Account | null> => ipcRenderer.invoke("accounts:active"),
    setActive: (id: string): Promise<Account | undefined> =>
      ipcRenderer.invoke("accounts:setActive", id),
    remove: (id: string): Promise<Account[]> =>
      ipcRenderer.invoke("accounts:remove", id),
    offline: (username: string): Promise<Account> =>
      ipcRenderer.invoke("accounts:offline", username),
    microsoftLogin: (): Promise<Account> =>
      ipcRenderer.invoke("accounts:microsoftLogin"),
    elyLogin: (): Promise<Account> =>
      ipcRenderer.invoke("accounts:elyLogin"),
  },
versions: {
  list: () => ipcRenderer.invoke("versions:list"),
  install: (id: string) => ipcRenderer.invoke("versions:install", id),
  delete: (id: string) => ipcRenderer.invoke("versions:delete", id),
  last: () => ipcRenderer.invoke("versions:last"),
  installUnofficial: (id: string, downloadUrl: string) => 
    ipcRenderer.invoke("versions:installUnofficial", id, downloadUrl),
  onUpdated: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("versions:updated", handler);
    return () => ipcRenderer.removeListener("versions:updated", handler);
  },
},
  game: {
    launch: (versionId: string, instancePath?: string, loader?: string): Promise<void> =>
      ipcRenderer.invoke("game:launch", versionId, instancePath, loader),
    isRunning: (): Promise<boolean> => ipcRenderer.invoke("game:isRunning"),
    kill: (): Promise<boolean> => ipcRenderer.invoke("game:kill"),
    onStatusChange: (cb: (isRunning: boolean) => void) => {
      const handler = (_: unknown, isRunning: boolean) => cb(isRunning);
      ipcRenderer.on("game:status", handler);
      return () => ipcRenderer.removeListener("game:status", handler);
    },
  },
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
	show: () => ipcRenderer.send("window:show"),
  },
updater: {
  check: () => ipcRenderer.invoke("updater:check"),
  getVersion: () => ipcRenderer.invoke("updater:getVersion"),
},
  shell: {
    open: (url: string) => ipcRenderer.invoke("shell:open", url),
  },
  skin: {
    getAvatar: (accountId: string) => ipcRenderer.invoke("skin:getAvatar", accountId),
    pickFile: () => ipcRenderer.invoke("skin:pickFile"),
    apply: (
      accountId: string,
      filePath: string,
      variant?: "classic" | "slim"
    ) => ipcRenderer.invoke("skin:apply", accountId, filePath, variant),
    reset: (accountId: string) => ipcRenderer.invoke("skin:reset", accountId),
    sync: (accountId: string) => ipcRenderer.invoke("skin:sync", accountId),
    previewHead: (filePath: string) => ipcRenderer.invoke("skin:previewHead", filePath),
	previewCape: (capeUrl: string) => ipcRenderer.invoke("skin:previewCape", capeUrl),
    getCapes: (accountId: string) => ipcRenderer.invoke("skin:getCapes", accountId),
    applyCape: (accountId: string, filePath: string) =>
      ipcRenderer.invoke("skin:applyCape", accountId, filePath),
    setOfficialCape: (accountId: string, capeId: string) =>
      ipcRenderer.invoke("skin:setOfficialCape", accountId, capeId),
    resetCape: (accountId: string) =>
      ipcRenderer.invoke("skin:resetCape", accountId),
  },
  modloader: {
    list: (loader: string, mcVersion: string) =>
      ipcRenderer.invoke("modloader:list", loader, mcVersion),
    install: (
      loader: string,
      mcVersion: string,
      options?: {
        loaderVersion?: string;
        withOptifine?: boolean;
        withSodiumIris?: boolean;
      }
    ) => ipcRenderer.invoke("modloader:install", loader, mcVersion, options ?? {}),
  },
  instances: {
    list: (): Promise<GameInstance[]> =>
      ipcRenderer.invoke("instances:list"),
    selected: (): Promise<string | null> => ipcRenderer.invoke("instances:selected"),
    setSelected: (id: string | null): Promise<string | null> =>
      ipcRenderer.invoke("instances:setSelected", id),
    installedVersions: (): Promise<string[]> =>
      ipcRenderer.invoke("instances:installedVersions"),
    create: (data: {
      name: string;
      versionId: string;
      icon?: InstanceIcon;
      notes?: string;
      loader?: "vanilla" | "fabric" | "forge" | "neoforge" | "quilt";
      withSodiumIris?: boolean;
      withOptifine?: boolean;
    }) => ipcRenderer.invoke("instances:create", data),
    update: (
      id: string,
      patch: Partial<Omit<GameInstance, "id">>
    ) => ipcRenderer.invoke("instances:update", id, patch),
    updateLoader: (
      id: string,
      newLoader: "vanilla" | "fabric" | "forge" | "neoforge" | "quilt",
      loaderVersion?: string
    ) => ipcRenderer.invoke("instances:updateLoader", id, newLoader, loaderVersion),
    remove: (id: string) => ipcRenderer.invoke("instances:remove", id),
    openFolder: (id: string) => ipcRenderer.invoke("instances:openFolder", id),
    launch: (id: string) => ipcRenderer.invoke("instances:launch", id),
  },
  modrinth: {
    search: (
      query: string,
      version?: string,
      loader?: string,
      offset?: number,
      limit?: number
    ): Promise<{ hits: ModrinthProject[]; total_hits: number }> =>
      ipcRenderer.invoke("modrinth:search", query, version, loader, offset, limit),
    installMod: (projectId: string, instanceId: string): Promise<boolean> =>
      ipcRenderer.invoke("modrinth:installMod", projectId, instanceId),
  },
  curseforge: {
    search: (
      query: string,
      version?: string,
      loader?: string,
      offset?: number,
      limit?: number
    ): Promise<{ hits: CurseForgeProject[]; total_hits: number }> =>
      ipcRenderer.invoke("curseforge:search", query, version, loader, offset, limit),
    installMod: (projectId: string, fileId: string, instanceId: string): Promise<boolean> =>
      ipcRenderer.invoke("curseforge:installMod", projectId, fileId, instanceId),
  },
  mods: {
    listInstalled: (instanceId: string): Promise<{ files: string[], map: Record<string, string> }> =>
      ipcRenderer.invoke("mods:listInstalled", instanceId),
    removeMod: (instanceId: string, fileName: string, projectKey?: string): Promise<boolean> =>
      ipcRenderer.invoke("mods:removeMod", instanceId, fileName, projectKey),
  },
  onLaunchProgress: (cb: (p: LaunchProgress) => void) => {
    const handler = (_: unknown, data: LaunchProgress) => cb(data);
    ipcRenderer.on("launch:progress", handler);
    return () => ipcRenderer.removeListener("launch:progress", handler);
  },
};

contextBridge.exposeInMainWorld("murflame", api);