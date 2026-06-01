import { contextBridge, ipcRenderer } from "electron";
import type {
  LauncherSettings,
  Account,
  VersionInfo,
  LaunchProgress,
  JavaInfo,
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
  },
  versions: {
    list: (): Promise<VersionInfo[]> => ipcRenderer.invoke("versions:list"),
    install: (id: string): Promise<void> =>
      ipcRenderer.invoke("versions:install", id),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke("versions:delete", id),
    last: (): Promise<string> => ipcRenderer.invoke("versions:last"),
  },
  game: {
    launch: (versionId: string): Promise<void> =>
      ipcRenderer.invoke("game:launch", versionId),
    isRunning: (): Promise<boolean> => ipcRenderer.invoke("game:isRunning"),
  },
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
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
    list: (): Promise<import("./types.js").GameInstance[]> =>
      ipcRenderer.invoke("instances:list"),
    selected: (): Promise<string | null> => ipcRenderer.invoke("instances:selected"),
    setSelected: (id: string | null): Promise<string | null> =>
      ipcRenderer.invoke("instances:setSelected", id),
    installedVersions: (): Promise<string[]> =>
      ipcRenderer.invoke("instances:installedVersions"),
    create: (data: {
      name: string;
      versionId: string;
      icon?: import("./types.js").GameInstance["icon"];
      notes?: string;
      loader?: "vanilla" | "fabric" | "forge" | "neoforge" | "quilt";
      withSodiumIris?: boolean;
      withOptifine?: boolean;
    }) => ipcRenderer.invoke("instances:create", data),
    update: (
      id: string,
      patch: Partial<Omit<import("./types.js").GameInstance, "id">>
    ) => ipcRenderer.invoke("instances:update", id, patch),
    remove: (id: string) => ipcRenderer.invoke("instances:remove", id),
    openFolder: (id: string) => ipcRenderer.invoke("instances:openFolder", id),
    launch: (id: string) => ipcRenderer.invoke("instances:launch", id),
  },
  onLaunchProgress: (cb: (p: LaunchProgress) => void) => {
    const handler = (_: unknown, data: LaunchProgress) => cb(data);
    ipcRenderer.on("launch:progress", handler);
    return () => ipcRenderer.removeListener("launch:progress", handler);
  },
};

contextBridge.exposeInMainWorld("murflame", api);
