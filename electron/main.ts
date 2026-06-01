import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  Tray,
  Menu,
  nativeImage,
} from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { existsSync } from "fs";
import { spawn, execSync } from "child_process";
import Store from "electron-store";
import { installFabric, installQuiltVersion, installForge, installNeoForged } from "@xmcl/installer";
import type {
  LauncherSettings,
  Account,
  VersionInfo,
  LaunchProgress,
  JavaInfo,
  GameInstance,
  InstanceLoader,
} from "./types.js";
import { DEFAULT_SETTINGS } from "./types.js";
import { accountSkinUrl, resolveAvatarUrl } from "./skinUtils.js";
import { skinBufferToHeadDataUrl } from "./skinHead.js";
import { applyProfileToAccount } from "./skinSync.js";

import {
  createInstanceRecord,
  detectLoader,
  ensureInstanceDirs,
  listInstalledVersionIds,
} from "./instances.js";
import { runLaunchGame } from "./launchGame.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Кэш для часто используемых данных
const manifestCache: Map<string, any> = new Map();
const versionCache: Map<string, VersionJson> = new Map();

// Глобальные настройки для доступа из launchGame
declare global {
  var __launcherSettings: { minMemory: number; maxMemory: number };
}

globalThis.__launcherSettings = {
  minMemory: 512,
  maxMemory: 4096
};

const store = new Store<{
  settings: LauncherSettings;
  accounts: Account[];
  activeAccountId: string | null;
  lastVersion: string;
  instances: GameInstance[];
  selectedInstanceId: string | null;
}>({
  defaults: {
    settings: { ...DEFAULT_SETTINGS },
    accounts: [],
    activeAccountId: null,
    lastVersion: "",
    instances: [],
    selectedInstanceId: null,
  },
});

let mainWindow: BrowserWindow | null = null;
let gameProcess: ReturnType<typeof spawn> | null = null;
let tray: Tray | null = null;

function getDefaultGameDir(): string {
  const appData = process.env.APPDATA || path.join(process.env.HOME || "", ".minecraft");
  return path.join(appData, ".murflame");
}

function resolveSettings(): LauncherSettings {
  const s = store.get("settings");
  if (!s.gameDir) s.gameDir = getDefaultGameDir();
  if (!s.versionFilter) {
    s.versionFilter = s.showSnapshots ? "all" : "release";
  }
  s.maxMemory = Math.max(1024, Math.min(s.maxMemory ?? DEFAULT_SETTINGS.maxMemory, 16384));
  s.minMemory = Math.max(256, Math.min(s.minMemory ?? DEFAULT_SETTINGS.minMemory, s.maxMemory));
  
  // Обновляем глобальные настройки
  globalThis.__launcherSettings = {
    minMemory: s.minMemory,
    maxMemory: s.maxMemory
  };
  
  return s;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function resolvePreloadPath(): string {
  const names = ["preload.cjs", "preload.mjs", "preload.js"];
  for (const name of names) {
    const p = path.join(__dirname, name);
    if (existsSync(p)) return p;
  }
  return path.join(__dirname, "preload.mjs");
}

// Функция для создания иконки в трее
function createTray() {
  // Путь к иконке
  let iconPath = path.join(__dirname, '../assets/icon.ico');
  
  if (!existsSync(iconPath)) {
    iconPath = path.join(__dirname, '../../assets/icon.ico');
  }
  if (!existsSync(iconPath)) {
    iconPath = path.join(process.resourcesPath, 'assets/icon.ico');
  }
  if (!existsSync(iconPath)) {
    iconPath = path.join(__dirname, '../public/icon.png');
  }
  
  let icon = nativeImage.createFromPath(iconPath);
  
  if (icon.isEmpty()) {
    console.warn('[MurFlame] Tray icon not found, using fallback');
    icon = nativeImage.createEmpty();
  }
  
  const trayIcon = icon.resize({ width: 16, height: 16 });
  
  tray = new Tray(trayIcon);
  tray.setToolTip('MurFlame Launcher');
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Показать MurFlame', 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      }
    },
    { 
      label: 'Свернуть в трей', 
      click: () => {
        mainWindow?.hide();
      }
    },
    { type: 'separator' },
    { 
      label: 'Выход', 
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    }
  });
  
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  const settings = resolveSettings();
  
  // Путь к иконке для окна
  let windowIconPath = path.join(__dirname, '../assets/icon.ico');
  if (!existsSync(windowIconPath)) {
    windowIconPath = path.join(__dirname, '../public/icon.png');
  }
  const windowIcon = nativeImage.createFromPath(windowIconPath);
  
  mainWindow = new BrowserWindow({
    width: settings.windowWidth,
    height: settings.windowHeight,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: "#0d0d12",
    show: false,
    icon: windowIcon.isEmpty() ? undefined : windowIcon,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const isDev = Boolean(devServerUrl);

  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.webContents.on("preload-error", (_e, preloadPath, err) => {
    console.error("[MurFlame] preload-error:", preloadPath, err);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev && devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function send(channel: string, data: unknown) {
  mainWindow?.webContents.send(channel, data);
}

async function findJavaInstallations(): Promise<JavaInfo[]> {
  const results: JavaInfo[] = [];
  const candidates: string[] = [];

  if (process.env.JAVA_HOME) {
    candidates.push(path.join(process.env.JAVA_HOME, "bin", "java.exe"));
  }

  const programFiles = [
    process.env["ProgramFiles"],
    process.env["ProgramFiles(x86)"],
  ].filter(Boolean) as string[];

  const vendors = ["Java", "Eclipse Adoptium", "Microsoft", "Zulu", "Amazon Corretto", "BellSoft"];
  
  for (const pf of programFiles) {
    for (const vendor of vendors) {
      const base = path.join(pf, vendor);
      if (!existsSync(base)) continue;
      
      try {
        const versions = await fs.readdir(base);
        for (const v of versions) {
          candidates.push(path.join(base, v, "bin", "java.exe"));
        }
      } catch { /* ignore */ }
    }
  }

  candidates.push("java");

  const seen = new Set<string>();
  for (const p of candidates) {
    if (seen.has(p)) continue;
    seen.add(p);
    try {
      const ver = execSync(`"${p}" -version 2>&1`, { encoding: "utf8", timeout: 5000 });
      const match = ver.match(/version "([^"]+)"/);
      if (match) {
        results.push({ path: p === "java" ? "java" : p, version: match[1] });
      }
    } catch { /* not valid */ }
  }
  return results;
}

interface MojangManifest {
  latest: { release: string; snapshot: string };
  versions: { id: string; type: string; url: string }[];
}

const MANIFEST_URLS = [
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
  "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json",
];

async function fetchManifest(): Promise<MojangManifest> {
  const cached = manifestCache.get('manifest');
  if (cached) return cached;

  let lastError = "Не удалось загрузить манифест версий";

  for (const url of MANIFEST_URLS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "MurFlame-Launcher/1.0" },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        lastError = `${url}: HTTP ${res.status}`;
        continue;
      }
      
      const text = await res.text();
      if (text.trimStart().startsWith("<") || text.includes("HTTP/1")) {
        lastError = `${url}: получен не JSON`;
        continue;
      }
      
      const manifest = JSON.parse(text) as MojangManifest;
      if (!manifest.versions?.length) {
        lastError = `${url}: пустой список версий`;
        continue;
      }
      
      manifestCache.set('manifest', manifest);
      return manifest;
    } catch (e) {
      lastError = (e as Error).message;
    }
  }

  throw new Error(lastError);
}

function resolveVersionFilter(settings: LauncherSettings): LauncherSettings["versionFilter"] {
  if (settings.versionFilter) return settings.versionFilter;
  return settings.showSnapshots ? "all" : "release";
}

async function getVersions(): Promise<VersionInfo[]> {
  const settings = resolveSettings();
  const manifest = await fetchManifest();
  const versionsDir = path.join(settings.gameDir, "versions");
  const filter = resolveVersionFilter(settings);

  const fromManifest = manifest.versions
    .filter((v) => filter === "all" || v.type === filter)
    .map((v) => ({
      id: v.id,
      type: v.type,
      installed: existsSync(path.join(versionsDir, v.id, `${v.id}.json`)),
    }));

  const manifestIds = new Set(fromManifest.map((v) => v.id));
  const installedExtra = listInstalledVersionIds(settings.gameDir)
    .filter((id) => !manifestIds.has(id))
    .map((id) => ({
      id,
      type: detectLoader(id) === "vanilla" ? "custom" : detectLoader(id),
      installed: true,
    }));

  return [...installedExtra, ...fromManifest];
}

function getInstances(): GameInstance[] {
  return store.get("instances") ?? [];
}

function saveInstances(instances: GameInstance[]) {
  store.set("instances", instances);
}

function findInstance(id: string): GameInstance | undefined {
  return getInstances().find((i) => i.id === id);
}

function upsertInstance(instance: GameInstance): GameInstance {
  const instances = getInstances();
  const idx = instances.findIndex((i) => i.id === instance.id);
  if (idx >= 0) instances[idx] = instance;
  else instances.unshift(instance);
  saveInstances(instances);
  store.set("selectedInstanceId", instance.id);
  return instance;
}

async function downloadFile(url: string, dest: string, onProgress?: (p: number) => void) {
  await ensureDir(path.dirname(dest));
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error(`Download failed: ${url}`);
    
    const total = Number(res.headers.get("content-length") || 0);
    const reader = res.body?.getReader();
    
    if (!reader) {
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(dest, buf);
      return;
    }
    
    const chunks: Uint8Array[] = [];
    let received = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total && onProgress) onProgress(Math.round((received / total) * 100));
    }
    
    const buf = Buffer.concat(chunks);
    await fs.writeFile(dest, buf);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

interface VersionJson {
  id: string;
  downloads: { client: { url: string; sha1: string; size: number } };
  libraries: LibraryEntry[];
  assetIndex: { id: string; url: string };
  mainClass: string;
  arguments?: { game: any[]; jvm: any[] };
  javaVersion?: { majorVersion: number };
}

interface LibraryEntry {
  name: string;
  downloads?: {
    artifact?: { url: string; path: string; sha1: string };
    classifiers?: Record<string, { url: string; path: string }>;
  };
  rules?: { action: string; os?: { name: string } }[];
  natives?: Record<string, string>;
}

function libApplies(lib: LibraryEntry): boolean {
  if (!lib.rules) return true;
  const osName = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "osx" : "linux";
  
  for (const rule of lib.rules) {
    if (rule.os?.name) {
      if (rule.action === "allow" && rule.os.name !== osName) return false;
      if (rule.action === "disallow" && rule.os.name === osName) return false;
    }
  }
  return true;
}

function mavenToPath(name: string): string {
  const parts = name.split(":");
  const [group, artifact, version] = parts;
  const classifier = parts[4];
  const fileName = classifier ? `${artifact}-${version}-${classifier}.jar` : `${artifact}-${version}.jar`;
  return `${group.replace(/\./g, "/")}/${artifact}/${version}/${fileName}`;
}

async function installVersion(versionId: string) {
  const settings = resolveSettings();
  await ensureDir(settings.gameDir);

  if (versionCache.has(versionId)) {
    console.log(`[MurFlame] Using cached version: ${versionId}`);
    return;
  }

  const manifest = await fetchManifest();
  const entry = manifest.versions.find((v) => v.id === versionId);
  if (!entry) throw new Error(`Version ${versionId} not found`);

  send("launch:progress", { stage: "fetch", percent: 5, message: "Загрузка метаданных..." } as LaunchProgress);

  const versionRes = await fetch(entry.url);
  const versionJson = (await versionRes.json()) as VersionJson;
  
  versionCache.set(versionId, versionJson);

  const versionDir = path.join(settings.gameDir, "versions", versionId);
  await ensureDir(versionDir);
  await fs.writeFile(
    path.join(versionDir, `${versionId}.json`),
    JSON.stringify(versionJson, null, 2)
  );

  send("launch:progress", { stage: "client", percent: 15, message: "Загрузка клиента..." } as LaunchProgress);

  const clientJar = path.join(versionDir, `${versionId}.jar`);
  if (!existsSync(clientJar)) {
    await downloadFile(versionJson.downloads.client.url, clientJar, (p) => {
      send("launch:progress", { stage: "client", percent: 15 + p * 0.25, message: `Клиент: ${p}%` } as LaunchProgress);
    });
  }

  send("launch:progress", { stage: "libraries", percent: 40, message: "Загрузка библиотек..." } as LaunchProgress);

  const libsDir = path.join(settings.gameDir, "libraries");
  const libs = versionJson.libraries.filter(libApplies);
  const osKey = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "osx" : "linux";

  await Promise.all(libs.map(async (lib, idx) => {
    const pct = 40 + (idx / libs.length) * 35;
    
    if (lib.downloads?.artifact) {
      const dest = path.join(libsDir, lib.downloads.artifact.path);
      if (!existsSync(dest)) {
        await downloadFile(lib.downloads.artifact.url, dest);
      }
    }
    
    if (lib.natives && lib.downloads?.classifiers) {
      const nativeKey = lib.natives[osKey]?.replace(
        "${arch}",
        process.arch === "x64" ? "64" : "32"
      );
      if (nativeKey && lib.downloads.classifiers[nativeKey]) {
        const nativeMeta = lib.downloads.classifiers[nativeKey];
        const dest = path.join(libsDir, nativeMeta.path);
        if (!existsSync(dest)) {
          await downloadFile(nativeMeta.url, dest);
        }
      }
    }
    
    if (lib.name && !lib.downloads?.artifact) {
      const rel = mavenToPath(lib.name);
      const dest = path.join(libsDir, rel);
      if (!existsSync(dest)) {
        const url = `https://libraries.minecraft.net/${rel}`;
        try {
          await downloadFile(url, dest);
        } catch { /* optional lib */ }
      }
    }
    
    send("launch:progress", { stage: "libraries", percent: pct, message: `Библиотеки ${idx + 1}/${libs.length}` } as LaunchProgress);
  }));

  send("launch:progress", { stage: "assets", percent: 78, message: "Загрузка ресурсов..." } as LaunchProgress);

  const assetsDir = path.join(settings.gameDir, "assets");
  const indexesDir = path.join(assetsDir, "indexes");
  await ensureDir(indexesDir);

  const indexPath = path.join(indexesDir, `${versionJson.assetIndex.id}.json`);
  if (!existsSync(indexPath)) {
    await downloadFile(versionJson.assetIndex.url, indexPath);
  }

  const indexContent = JSON.parse(await fs.readFile(indexPath, "utf8")) as {
    objects: Record<string, { hash: string; size: number }>;
  };

  const objects = Object.entries(indexContent.objects);
  
  const chunkSize = 50;
  for (let i = 0; i < objects.length; i += chunkSize) {
    const chunk = objects.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async ([name, obj]) => {
      const hashPrefix = obj.hash.substring(0, 2);
      const dest = path.join(assetsDir, "objects", hashPrefix, obj.hash);
      if (!existsSync(dest)) {
        await ensureDir(path.dirname(dest));
        const url = `https://resources.download.minecraft.net/${hashPrefix}/${obj.hash}`;
        try {
          await downloadFile(url, dest);
        } catch { /* skip */ }
      }
    }));
    
    send("launch:progress", {
      stage: "assets",
      percent: 78 + ((i + chunk.length) / objects.length) * 18,
      message: `Ресурсы ${Math.min(i + chunk.length, objects.length)}/${objects.length}`,
    } as LaunchProgress);
  }

  send("launch:progress", { stage: "done", percent: 100, message: "Установка завершена!" } as LaunchProgress);
}

import { offline, getOfflineUUID, MicrosoftAuthenticator, MojangClient } from "@xmcl/user";

const MS_CLIENT_ID = "00000000402b5328";
const MS_REDIRECT_URI = "https://login.live.com/oauth20_desktop.srf";

function getMicrosoftAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: MS_REDIRECT_URI,
    scope: "XboxLive.signin offline_access",
    prompt: "select_account",
  });
  return `https://login.live.com/oauth20_authorize.srf?${params}`;
}

async function refreshMicrosoftToken(account: Account): Promise<Account> {
  if (account.type !== "microsoft" || !account.refreshToken) return account;
  if (account.expiresAt && account.expiresAt > Date.now() + 120_000) return account;

  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    refresh_token: account.refreshToken,
    grant_type: "refresh_token",
    redirect_uri: MS_REDIRECT_URI,
  });
  
  const res = await fetch("https://login.live.com/oauth20_token.srf", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  
  if (!res.ok) return account;

  const token = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const msAuth = new MicrosoftAuthenticator({});
  const { minecraftXstsResponse } = await msAuth.acquireXBoxToken(token.access_token);
  const uhs = minecraftXstsResponse.DisplayClaims.xui[0].uhs;
  const mc = await msAuth.loginMinecraftWithXBox(uhs, minecraftXstsResponse.Token);

  const updated: Account = {
    ...account,
    accessToken: mc.access_token,
    refreshToken: token.refresh_token ?? account.refreshToken,
    expiresAt: Date.now() + mc.expires_in * 1000,
  };

  const accounts = store.get("accounts").map((a: Account) =>
    a.id === updated.id ? updated : a
  );
  store.set("accounts", accounts);
  return updated;
}

function saveAccount(account: Account) {
  const accounts = store.get("accounts").filter((a: Account) => a.id !== account.id);
  accounts.push(account);
  store.set("accounts", accounts);
  store.set("activeAccountId", account.id);
  return account;
}

async function microsoftLoginInteractive(): Promise<Account> {
  return new Promise((resolve, reject) => {
    let finished = false;

    const authWindow = new BrowserWindow({
      width: 520,
      height: 720,
      parent: mainWindow ?? undefined,
      modal: Boolean(mainWindow),
      title: "Вход Microsoft",
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const finish = (fn: () => void) => {
      if (finished) return;
      finished = true;
      fn();
    };

    const tryCaptureCode = async (url: string) => {
      if (!url.includes("oauth20_desktop.srf")) return;
      try {
        const parsed = new URL(url);
        const err = parsed.searchParams.get("error_description") || parsed.searchParams.get("error");
        if (err) {
          finish(() => {
            authWindow.close();
            reject(new Error(decodeURIComponent(err)));
          });
          return;
        }
        const code = parsed.searchParams.get("code");
        if (!code) return;
        finish(() => {
          authWindow.close();
          microsoftLoginWithCode(code).then(resolve).catch(reject);
        });
      } catch (e) {
        finish(() => {
          authWindow.close();
          reject(e);
        });
      }
    };

    authWindow.webContents.on("will-redirect", (_e, url) => void tryCaptureCode(url));
    authWindow.webContents.on("did-navigate", (_e, url) => void tryCaptureCode(url));
    authWindow.on("closed", () => {
      finish(() => reject(new Error("Вход отменён")));
    });

    authWindow.loadURL(getMicrosoftAuthUrl()).catch((e) => {
      finish(() => {
        authWindow.close();
        reject(e);
      });
    });
  });
}

async function exchangeMicrosoftCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    code: code.trim(),
    grant_type: "authorization_code",
    redirect_uri: MS_REDIRECT_URI,
  });
  const res = await fetch("https://login.live.com/oauth20_token.srf", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth ошибка: ${err}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

async function microsoftLoginWithCode(authCode: string): Promise<Account> {
  const token = await exchangeMicrosoftCode(authCode);
  const msAuth = new MicrosoftAuthenticator({});
  const { minecraftXstsResponse } = await msAuth.acquireXBoxToken(token.access_token);
  const uhs = minecraftXstsResponse.DisplayClaims.xui[0].uhs;
  const mc = await msAuth.loginMinecraftWithXBox(uhs, minecraftXstsResponse.Token);
  const mojang = new MojangClient({});
  const profile = await mojang.getProfile(mc.access_token);

  let account: Account = {
    id: profile.id,
    type: "microsoft",
    username: profile.name,
    uuid: profile.id,
    accessToken: mc.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + mc.expires_in * 1000,
    skinUrl: accountSkinUrl({ username: profile.name, uuid: profile.id }),
  };

  account = await applyProfileToAccount(account, mc.access_token);
  return saveAccount(account);
}

function offlineLogin(username: string): Account {
  if (!username.trim()) throw new Error("Введите никнейм");
  const auth = offline(username.trim());
  const uuid = auth.selectedProfile.id;
  const account: Account = {
    id: uuid,
    type: "offline",
    username: auth.selectedProfile.name,
    uuid,
    accessToken: auth.accessToken,
    skinUrl: accountSkinUrl({ username: auth.selectedProfile.name, uuid }),
  };
  return saveAccount(account);
}

function resolveJavaExecutable(javaPath: string): string {
  if (process.platform !== "win32") return javaPath || "java";
  if (!javaPath || javaPath === "java") return "javaw";
  if (/java\.exe$/i.test(javaPath)) {
    const javaw = javaPath.replace(/java\.exe$/i, "javaw.exe");
    if (existsSync(javaw)) return javaw;
  }
  return javaPath;
}

async function launchGame(versionId: string, instanceId?: string, loader?: string) {
  console.log("[MurFlame] launchGame called with:", { versionId, instanceId, loader });
  
  if (!versionId) throw new Error("Не передана версия для запуска");
  
  const settings = resolveSettings();
  const accountId = store.get("activeAccountId");
  const accounts = store.get("accounts");
  let account = accounts.find((a) => a.id === accountId);
  if (!account) throw new Error("Выберите аккаунт");

  if (account.type === "microsoft") {
    account = await refreshMicrosoftToken(account);
  }

  const instancePath = instanceId ? await ensureInstanceDirs(settings.gameDir, instanceId) : settings.gameDir;
  
  await runLaunchGame(
    versionId,
    instancePath,
    settings.gameDir,
    (p) => send("launch:progress", p),
    loader,
    account.username,
    account.accessToken
  );

  if (instanceId) {
    const inst = findInstance(instanceId);
    if (inst) {
      inst.lastPlayed = Date.now();
      upsertInstance(inst);
    }
  }
  store.set("lastVersion", versionId);

  if (settings.closeOnLaunch) mainWindow?.minimize();
}

function registerIpc() {
  ipcMain.handle("settings:get", () => resolveSettings());
  
  ipcMain.handle("settings:set", (_e, partial: Partial<LauncherSettings>) => {
    const current = resolveSettings();
    const next = { ...current, ...partial };
    
    // Валидация настроек памяти
    if (next.maxMemory) {
      next.maxMemory = Math.max(1024, Math.min(next.maxMemory, 16384));
    }
    if (next.minMemory) {
      next.minMemory = Math.max(256, Math.min(next.minMemory, next.maxMemory || 8192));
    }
    
    store.set("settings", next);
    
    // Обновляем глобальные настройки для launchGame
    globalThis.__launcherSettings = {
      minMemory: next.minMemory,
      maxMemory: next.maxMemory
    };
    
    return next;
  });

  // Добавляем обработчик для получения настроек памяти
  ipcMain.handle("settings:getMemory", () => {
    const settings = resolveSettings();
    return {
      minMemory: settings.minMemory,
      maxMemory: settings.maxMemory
    };
  });

  ipcMain.handle("settings:pickGameDir", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
  });

  ipcMain.handle("settings:pickJava", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: [{ name: "Java", extensions: ["exe"] }],
    });
    return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
  });

  ipcMain.handle("java:list", () => findJavaInstallations());

  ipcMain.handle("accounts:list", async () => {
    const accounts = store.get("accounts") as Account[];
    const out: Account[] = [];
    for (const acc of accounts) {
      if (acc.type === "microsoft" && acc.accessToken) {
        try {
          const refreshed = await refreshMicrosoftToken(acc);
          const updated = await applyProfileToAccount(
            { ...acc, accessToken: refreshed.accessToken },
            refreshed.accessToken!
          );
          updated.refreshToken = refreshed.refreshToken ?? acc.refreshToken;
          updated.expiresAt = refreshed.expiresAt ?? acc.expiresAt;
          out.push(updated);
        } catch {
          out.push(acc);
        }
      } else {
        out.push(acc);
      }
    }
    store.set("accounts", out);
    return out;
  });
  
  ipcMain.handle("accounts:active", () => {
    const id = store.get("activeAccountId");
    return store.get("accounts").find((a) => a.id === id) || null;
  });
  
  ipcMain.handle("accounts:setActive", (_e, id: string) => {
    store.set("activeAccountId", id);
    return store.get("accounts").find((a) => a.id === id);
  });
  
  ipcMain.handle("accounts:remove", (_e, id: string) => {
    const accounts = store.get("accounts").filter((a) => a.id !== id);
    store.set("accounts", accounts);
    if (store.get("activeAccountId") === id) {
      store.set("activeAccountId", accounts[0]?.id || null);
    }
    return accounts;
  });
  
  ipcMain.handle("accounts:offline", (_e, username: string) => offlineLogin(username));
  ipcMain.handle("accounts:microsoftLogin", () => microsoftLoginInteractive());
  ipcMain.handle("accounts:microsoft", (_e, code: string) => microsoftLoginWithCode(code));

  ipcMain.handle("versions:list", async () => {
    try {
      return await getVersions();
    } catch (e) {
      console.error("[MurFlame] versions:list failed:", e);
      throw e;
    }
  });
  
  ipcMain.handle("versions:install", (_e, id: string) => installVersion(id));
  
  ipcMain.handle("versions:delete", async (_e, id: string) => {
    const settings = resolveSettings();
    const versionDir = path.join(settings.gameDir, "versions", id);
    if (existsSync(versionDir)) {
      await fs.rm(versionDir, { recursive: true, force: true });
      versionCache.delete(id);
    }
  });
  
  ipcMain.handle("versions:last", () => store.get("lastVersion"));
  ipcMain.handle("game:launch", (_e, versionId: string) => launchGame(versionId));
  ipcMain.handle("instances:list", () => getInstances());
  ipcMain.handle("instances:selected", () => store.get("selectedInstanceId"));
  
  ipcMain.handle("instances:setSelected", (_e, id: string | null) => {
    store.set("selectedInstanceId", id);
    return id;
  });
  
  ipcMain.handle("instances:installedVersions", () => {
    const settings = resolveSettings();
    return listInstalledVersionIds(settings.gameDir);
  });
  
  ipcMain.handle("instances:create", async (_e, data: {
    name: string;
    versionId: string;
    icon?: GameInstance["icon"];
    notes?: string;
    loader?: "vanilla" | "fabric" | "forge" | "neoforge" | "quilt";
    withSodiumIris?: boolean;
    withOptifine?: boolean;
  }) => {
    const settings = resolveSettings();
    let finalVersionId = data.versionId;

    if (data.loader && data.loader !== "vanilla") {
      const baseVersion = data.versionId.match(/^(\d+\.\d+(?:\.\d+)?)/)?.[1] || data.versionId;
      
      const vanillaVersionDir = path.join(settings.gameDir, "versions", baseVersion);
      if (!existsSync(vanillaVersionDir)) {
        send("launch:progress", { stage: "vanilla", percent: 10, message: "Установка ванильной версии..." } as LaunchProgress);
        await installVersion(baseVersion);
      }

      send("launch:progress", { stage: "modloader", percent: 30, message: `Установка ${data.loader}...` } as LaunchProgress);
      
      let versionId: string;
      switch (data.loader) {
        case "forge":
          const forgeApiUrl = `https://bmclapi2.bangbang93.com/forge/minecraft/${baseVersion}`;
          const forgeResponse = await fetch(forgeApiUrl);
          if (!forgeResponse.ok) throw new Error(`Не удалось получить список Forge: ${forgeResponse.status}`);
          const forgeVersions = await forgeResponse.json();
          if (!forgeVersions?.length) throw new Error(`Forge не поддерживает Minecraft ${baseVersion}`);
          
          let selectedForge = forgeVersions[0];
          for (const version of forgeVersions) {
            const verStr = typeof version === 'string' ? version : version.version;
            if (verStr === "36.2.34") {
              selectedForge = version;
              break;
            }
            if (verStr.startsWith("36.2.")) {
              selectedForge = version;
            }
          }
          
          const forgeVer = typeof selectedForge === 'string' ? selectedForge : selectedForge.version;
          const forgeVersionId = `${baseVersion}-forge-${forgeVer}`;
          
          send("launch:progress", { stage: "modloader", percent: 50, message: `Установка Forge ${forgeVer}...` } as LaunchProgress);
          
          await installForge(
            {
              mcversion: baseVersion,
              version: forgeVer,
              installer: {
                path: `net/minecraftforge/forge/${baseVersion}-${forgeVer}/forge-${baseVersion}-${forgeVer}-installer.jar`
              }
            },
            settings.gameDir,
            { mavenHost: ["https://maven.minecraftforge.net/"] }
          );
          versionId = forgeVersionId;
          console.log(`[MurFlame] Forge installed: ${versionId}`);
          break;
          
        case "fabric":
          send("launch:progress", { stage: "modloader", percent: 35, message: "Установка Fabric..." });
          const fabricApiUrl = `https://meta.fabricmc.net/v2/versions/loader/${baseVersion}`;
          const fabricResponse = await fetch(fabricApiUrl);
          const fabricVersions = await fabricResponse.json();
          const latestFabricVersion = fabricVersions[0].loader.version;
          versionId = await installFabric({
            minecraftVersion: baseVersion,
            version: latestFabricVersion,
            minecraft: settings.gameDir
          });
          console.log(`[MurFlame] Fabric installed: ${versionId}`);
          break;
          
        case "neoforge":
        case "quilt":
          throw new Error(`${data.loader === "neoforge" ? "NeoForge" : "Quilt"} временно недоступен. Пожалуйста, используйте Forge или Fabric.`);
          
        default:
          throw new Error(`Неподдерживаемый мод-лоадер: ${data.loader}`);
      }
      
      finalVersionId = versionId || data.versionId;
    }

    // Создаём финальный инстанс
    const instance = createInstanceRecord({
      name: data.name,
      versionId: finalVersionId,
      icon: data.icon,
      notes: data.notes,
      loader: data.loader || "vanilla",
    });
    
    await ensureInstanceDirs(settings.gameDir, instance.id, instance.name);
    
    const modsDir = path.join(settings.gameDir, "instances", instance.id, "mods");
    
    // Установка Sodium + Iris для Fabric
    if (data.withSodiumIris && data.loader === "fabric") {
      send("launch:progress", { stage: "mods", percent: 70, message: "Установка Sodium + Iris..." } as LaunchProgress);
      
      const baseVersion = data.versionId.match(/^(\d+\.\d+(?:\.\d+)?)/)?.[1] || data.versionId;
      
      const getModrinthDownloadUrl = async (projectId: string, gameVersion: string, loader: string) => {
        try {
          const url = `https://api.modrinth.com/v2/project/${projectId}/version`;
          const response = await fetch(`${url}?game_versions=["${gameVersion}"]&loaders=["${loader}"]`, {
            headers: { "User-Agent": "MurFlame-Launcher/1.0" }
          });
          if (!response.ok) return null;
          const versions = await response.json();
          if (versions?.length) {
            const file = versions[0].files.find((f: any) => f.primary);
            return file?.url;
          }
          return null;
        } catch {
          return null;
        }
      };
      
      try {
        const sodiumUrl = await getModrinthDownloadUrl("AANobbMI", baseVersion, "fabric");
        if (sodiumUrl) await downloadFile(sodiumUrl, path.join(modsDir, `sodium-${baseVersion}.jar`));
      } catch (e) { console.warn("Sodium download failed:", e); }
      
      try {
        const irisUrl = await getModrinthDownloadUrl("YL57xq9U", baseVersion, "fabric");
        if (irisUrl) await downloadFile(irisUrl, path.join(modsDir, `iris-${baseVersion}.jar`));
      } catch (e) { console.warn("Iris download failed:", e); }
    }
    
    // Установка OptiFine для Forge
    if (data.withOptifine && data.loader === "forge") {
      send("launch:progress", { stage: "mods", percent: 70, message: "Установка OptiFine..." } as LaunchProgress);
      
      const baseVersion = data.versionId.match(/^(\d+\.\d+(?:\.\d+)?)/)?.[1] || data.versionId;
      
      const getOptiFineVersion = async (mcVersion: string) => {
        try {
          const url = `https://bmclapi2.bangbang93.com/optifine/${mcVersion}`;
          const response = await fetch(url, { headers: { "User-Agent": "MurFlame-Launcher/1.0" } });
          if (!response.ok) return null;
          const versions = await response.json();
          if (versions?.length) {
            const stable = versions.find((v: any) => v.type === "HD_U" && !v.patch?.includes("pre"));
            return stable || versions[0];
          }
          return null;
        } catch {
          return null;
        }
      };
      
      try {
        const optifineInfo = await getOptiFineVersion(baseVersion);
        if (optifineInfo) {
          const optifineUrl = `https://bmclapi2.bangbang93.com/optifine/${baseVersion}/${optifineInfo.type}/${optifineInfo.patch}`;
          await downloadFile(optifineUrl, path.join(modsDir, `OptiFine_${baseVersion}.jar`));
        }
      } catch (e) { console.warn("OptiFine download failed:", e); }
    }
    
    send("launch:progress", { stage: "complete", percent: 100, message: "Установка завершена" } as LaunchProgress);
    return upsertInstance(instance);
  });
  
  ipcMain.handle("instances:update", (_e, id: string, patch: Partial<Omit<GameInstance, "id">>) => {
    const inst = findInstance(id);
    if (!inst) throw new Error("Экземпляр не найден");
    return upsertInstance({ ...inst, ...patch, id: inst.id });
  });
  
  ipcMain.handle("instances:updateLoader", async (_e, id: string, newLoader: InstanceLoader, loaderVersion?: string) => {
    const inst = findInstance(id);
    if (!inst) throw new Error("Экземпляр не найден");
    const settings = resolveSettings();
    const baseVersion = inst.versionId.match(/^(\d+\.\d+(?:\.\d+)?)/)?.[1] || inst.versionId;
    
    inst.loader = newLoader;
    upsertInstance(inst);
    
    if (newLoader !== "vanilla") {
      send("launch:progress", { stage: "modloader", percent: 0, message: `Установка ${newLoader}...` } as LaunchProgress);
      
      const vanillaVersionDir = path.join(settings.gameDir, "versions", baseVersion);
      if (!existsSync(vanillaVersionDir)) {
        await installVersion(baseVersion);
      }
      
      let versionId: string;
      switch (newLoader) {
        case "forge":
          versionId = `${baseVersion}-forge-${loaderVersion || "latest"}`;
          break;
        case "fabric":
          const fabricApiUrl = `https://meta.fabricmc.net/v2/versions/loader/${baseVersion}`;
          const fabricResponse = await fetch(fabricApiUrl);
          const fabricVersions = await fabricResponse.json();
          const latestFabricVersion = fabricVersions[0].loader.version;
          versionId = `fabric-loader-${latestFabricVersion}-${baseVersion}`;
          break;
        case "neoforge":
        case "quilt":
          versionId = `${baseVersion}-${newLoader}-${loaderVersion || "latest"}`;
          break;
        default:
          throw new Error(`Неподдерживаемый мод-лоадер: ${newLoader}`);
      }
      
      inst.versionId = versionId;
      upsertInstance(inst);
    }
    return inst;
  });
  
  ipcMain.handle("instances:remove", async (_e, id: string) => {
    const instances = getInstances().filter((i) => i.id !== id);
    saveInstances(instances);
    if (store.get("selectedInstanceId") === id) {
      store.set("selectedInstanceId", instances[0]?.id ?? null);
    }
    return instances;
  });
  
  ipcMain.handle("instances:openFolder", async (_e, id: string) => {
    const settings = resolveSettings();
    const dir = await ensureInstanceDirs(settings.gameDir, id);
    await shell.openPath(dir);
    return dir;
  });
  
  ipcMain.handle("instances:launch", (_e, id) => {
    const inst = findInstance(id);
    if (!inst) throw new Error("Экземпляр не найден");
    if (!inst.versionId) throw new Error(`У экземпляра ${id} нет версии`);
    store.set("selectedInstanceId", id);
    return launchGame(inst.versionId, id, inst.loader);
  });
  
  ipcMain.handle("game:isRunning", () => gameProcess !== null && !gameProcess?.killed);

  ipcMain.on("window:minimize", () => mainWindow?.minimize());
  ipcMain.on("window:maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  
  // Изменяем обработку закрытия окна
  ipcMain.on("window:close", () => {
    const settings = resolveSettings();
    if (settings.closeToTray && tray) {
      mainWindow?.hide();
    } else {
      app.quit();
    }
  });

  ipcMain.handle("shell:open", (_e, url: string) => shell.openExternal(url));
  
  ipcMain.handle("skin:getAvatar", async (_e, accountId: string) => {
    const acc = store.get("accounts").find((a: Account) => a.id === accountId);
    if (!acc) return "";
    if (acc.type === "microsoft") return resolveAvatarUrl(acc);
    if (acc.skinHeadUrl?.startsWith("data:")) return acc.skinHeadUrl;
    if (acc.localSkinPath && existsSync(acc.localSkinPath)) {
      const buf = await fs.readFile(acc.localSkinPath);
      return skinBufferToHeadDataUrl(buf, 96);
    }
    return resolveAvatarUrl(acc);
  });

  ipcMain.handle("skin:sync", async (_e, accountId: string) => {
    const acc = store.get("accounts").find((a: Account) => a.id === accountId);
    if (!acc) throw new Error("Аккаунт не найден");
    if (acc.type !== "microsoft" || !acc.accessToken) return acc;
    const refreshed = await refreshMicrosoftToken(acc);
    const updated = await applyProfileToAccount(
      { ...acc, accessToken: refreshed.accessToken },
      refreshed.accessToken!
    );
    updated.refreshToken = refreshed.refreshToken ?? acc.refreshToken;
    updated.expiresAt = refreshed.expiresAt ?? acc.expiresAt;
    return saveAccount(updated);
  });

  ipcMain.handle("skin:previewHead", async (_e, filePath: string) => {
    const buf = await fs.readFile(filePath);
    return skinBufferToHeadDataUrl(buf, 96);
  });

  ipcMain.handle("skin:pickFile", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: [{ name: "Скин PNG", extensions: ["png"] }],
    });
    return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
  });

  ipcMain.handle("skin:apply", async (_e, accountId: string, filePath: string, variant: "classic" | "slim" = "classic") => {
    const accounts = store.get("accounts");
    const acc = accounts.find((a: Account) => a.id === accountId);
    if (!acc) throw new Error("Аккаунт не найден");

    const buf = await fs.readFile(filePath);
    const settings = resolveSettings();
    const skinsDir = path.join(settings.gameDir, "murflame", "skins");
    await ensureDir(skinsDir);
    const dest = path.join(skinsDir, `${accountId}.png`);
    await fs.writeFile(dest, buf);

    acc.skinVariant = variant;

    if (acc.type === "microsoft" && acc.accessToken) {
      const refreshed = await refreshMicrosoftToken(acc);
      const mojang = new MojangClient({});
      await mojang.setSkin("skin.png", buf, variant, refreshed.accessToken!);
      await new Promise((r) => setTimeout(r, 2500));
      const updated = await applyProfileToAccount(
        {
          ...acc,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? acc.refreshToken,
          expiresAt: refreshed.expiresAt ?? acc.expiresAt,
        },
        refreshed.accessToken!
      );
      await fs.writeFile(dest, buf);
      return saveAccount(updated);
    }

    acc.localSkinPath = dest;
    acc.skinHeadUrl = skinBufferToHeadDataUrl(buf, 96);
    acc.skinUrl = acc.skinHeadUrl;
    return saveAccount(acc);
  });

  ipcMain.handle("skin:reset", async (_e, accountId: string) => {
    const accounts = store.get("accounts");
    const acc = accounts.find((a: Account) => a.id === accountId);
    if (!acc) throw new Error("Аккаунт не найден");

    if (acc.localSkinPath && existsSync(acc.localSkinPath)) {
      await fs.unlink(acc.localSkinPath).catch(() => {});
    }
    delete acc.localSkinPath;

    if (acc.type === "microsoft" && acc.accessToken) {
      const refreshed = await refreshMicrosoftToken(acc);
      try {
        const mojang = new MojangClient({});
        await mojang.resetSkin(refreshed.accessToken!);
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        console.warn("[MurFlame] Mojang resetSkin failed:", e);
      }
      try {
        const updated = await applyProfileToAccount(
          {
            ...acc,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken ?? acc.refreshToken,
            expiresAt: refreshed.expiresAt ?? acc.expiresAt,
          },
          refreshed.accessToken!
        );
        return saveAccount(updated);
      } catch {
        acc.skinUrl = accountSkinUrl(acc);
        delete acc.skinHeadUrl;
        delete acc.skinTextureUrl;
        return saveAccount(acc);
      }
    }

    acc.skinUrl = accountSkinUrl(acc);
    delete acc.skinHeadUrl;
    delete acc.skinTextureUrl;
    return saveAccount(acc);
  });
}

app.whenReady().then(() => {
  const settings = resolveSettings();
  if (!settings.gameDir) {
    store.set("settings", { ...settings, gameDir: getDefaultGameDir() });
  }
  registerIpc();
  createWindow();
  createTray(); // Создаём иконку в трее
});

// Исправленная обработка закрытия всех окон (без параметра event)
app.on('window-all-closed', () => {
  if (tray) {
    // Если есть трей, не закрываем приложение, а просто прячем окно
    if (mainWindow) {
      mainWindow.hide();
    }
  } else {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});