import fs from "fs/promises";
import path from "path";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { spawn, ChildProcess, exec } from "child_process";
import { getJavaRuntimePath, ensureJavaRuntime } from "./java.js";
import type { LaunchProgress } from "./types.js";
import { installForge, installFabric } from "@xmcl/installer";
import iconv from "iconv-lite";
import AdmZip from "adm-zip";
import http from "http";

type ProgressSender = (p: LaunchProgress) => void;

declare global {
  var __launcherSettings: { minMemory: number; maxMemory: number };
}

let currentGameProcess: ChildProcess | null = null;
let skinServer: http.Server | null = null;
let skinServerPort: number = 0;

// Альтернативные репозитории для старых библиотек
const ALTERNATIVE_REPOSITORIES = [
  "https://bmclapi2.bangbang93.com/libraries/",
  "https://libraries.minecraft.net/",
  "https://repo1.maven.org/maven2/"
];

// Рекомендуемые стабильные версии Forge для старых версий Minecraft
const RECOMMENDED_FORGE_VERSIONS: Record<string, string> = {
  "1.7.10": "10.13.4.1614",
  "1.8.9": "11.15.1.2318",
  "1.9.4": "12.17.0.2317",
  "1.10.2": "12.18.3.2511",
  "1.11.2": "13.20.1.2588",
  "1.12.2": "14.23.5.2860"
};

function sendDefault(sender: ProgressSender, p: Partial<LaunchProgress>) {
  sender({ stage: "launch", percent: 0, message: "", ...p } as LaunchProgress);
}

async function getMemorySettings(): Promise<{ minMemory: number; maxMemory: number }> {
  if (typeof globalThis !== "undefined" && globalThis.__launcherSettings) {
    return {
      minMemory: globalThis.__launcherSettings.minMemory || 512,
      maxMemory: globalThis.__launcherSettings.maxMemory || 4096,
    };
  }
  return { minMemory: 512, maxMemory: 4096 };
}

async function downloadFile(url: string, dest: string, retries = 3): Promise<void> {
  const dir = path.dirname(dest);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(dest, buffer);
        return;
      }
      console.log(`[MurFlame] Attempt ${i + 1} failed for ${url}: ${response.status}`);
    } catch (e) {
      console.log(`[MurFlame] Attempt ${i + 1} error for ${url}: ${e}`);
    }
  }
  throw new Error(`Failed to download ${url} after ${retries} attempts`);
}

async function downloadWithFallback(libPath: string, gameDir: string): Promise<string | null> {
  const dest = path.join(gameDir, "libraries", libPath);
  
  if (existsSync(dest)) {
    return dest;
  }
  
  for (const repo of ALTERNATIVE_REPOSITORIES) {
    const url = `${repo}${libPath}`;
    try {
      console.log(`[MurFlame] Trying to download from: ${url}`);
      await downloadFile(url, dest, 2);
      if (existsSync(dest)) {
        console.log(`[MurFlame] Successfully downloaded from ${repo}`);
        return dest;
      }
    } catch (e) {
      console.log(`[MurFlame] Failed to download from ${repo}: ${e}`);
    }
  }
  
  return null;
}

function mavenPath(libName: string): string {
  const parts = libName.split(":");
  if (parts.length < 3) return "";
  
  const group = parts[0];
  const artifact = parts[1];
  const version = parts[2];
  const classifier = parts[3];
  
  const groupPath = group.replace(/\./g, "/");
  const fileName = classifier 
    ? `${artifact}-${version}-${classifier}.jar`
    : `${artifact}-${version}.jar`;
  
  return `${groupPath}/${artifact}/${version}/${fileName}`;
}

function getLibraryUrl(lib: any): string | null {
  if (lib.downloads?.artifact?.url) {
    return lib.downloads.artifact.url;
  }
  
  if (lib.url) {
    const mavenPathStr = lib.name ? mavenPath(lib.name) : "";
    if (mavenPathStr) {
      return `${lib.url}${mavenPathStr}`;
    }
  }
  
  return null;
}

async function downloadLibraryJar(lib: any, gameDir: string): Promise<string | null> {
  const url = getLibraryUrl(lib);
  if (url) {
    const mavenPathStr = lib.name ? mavenPath(lib.name) : "";
    if (mavenPathStr) {
      const dest = path.join(gameDir, "libraries", mavenPathStr);
      if (existsSync(dest)) {
        return dest;
      }
      try {
        await downloadFile(url, dest);
        return dest;
      } catch (e) {
        console.log(`[MurFlame] Failed to download from primary URL: ${e}`);
      }
    }
  }
  
  if (lib.name) {
    const mavenPathStr = mavenPath(lib.name);
    if (mavenPathStr) {
      return await downloadWithFallback(mavenPathStr, gameDir);
    }
  }
  
  return null;
}

async function installVanillaVersion(versionId: string, gameDir: string) {
  console.log(`[MurFlame] Installing vanilla version: ${versionId}`);

  const manifestUrl = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
  const manifest = await fetch(manifestUrl).then((r) => r.json());
  const version = manifest.versions.find((v: any) => v.id === versionId);

  if (!version) {
    throw new Error(`Vanilla version ${versionId} not found`);
  }

  const versionJson = await fetch(version.url).then((r) => r.json());
  const versionDir = path.join(gameDir, "versions", versionId);
  await fs.mkdir(versionDir, { recursive: true });

  const jsonPath = path.join(versionDir, `${versionId}.json`);
  if (!existsSync(jsonPath)) {
    await fs.writeFile(jsonPath, JSON.stringify(versionJson, null, 2));
  }

  const clientJar = path.join(versionDir, `${versionId}.jar`);
  if (!existsSync(clientJar)) {
    console.log(`[MurFlame] Downloading client...`);
    const response = await fetch(versionJson.downloads.client.url);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(clientJar, buffer);
  }

  console.log(`[MurFlame] Vanilla version installed`);
}

function getMcVersion(versionId: string): string {
  // Для кастомных версий (начинаются с alpha-, custom, содержат remastered)
  if (versionId === "custom" || 
      versionId.startsWith("alpha-") || 
      versionId.includes("remastered") ||
      versionId === "alpha-1.2.3_03-remastered") {
    return "custom";
  }
  return versionId.split("-")[0];
}

function getMajorVersion(versionId: string): number {
  const mcVersion = getMcVersion(versionId);
  
  // Для кастомных версий возвращаем 8 (Java 8 для старых версий)
  if (mcVersion === "custom") {
    return 8;
  }
  
  const parts = mcVersion.split(".");
  
  // Minecraft 26.1.2, 26w02a, etc.
  if (parts.length >= 1 && !parts[0].startsWith("1")) {
    return parseInt(parts[0]);
  }
  
  // Minecraft 1.21.4, 1.20.4, etc.
  if (parts.length >= 2 && parts[0] === "1") {
    return parseInt(parts[1]);
  }
  
  // Fallback
  return parseInt(parts[0] || "0");
}

function getRequiredJavaVersion(versionId: string): "java8" | "java17" | "java21" | "java25" {
  const major = getMajorVersion(versionId);
  
  console.log(`[MurFlame] Detected major version: ${major}`);
  
  // Для версий 25+ пробуем Java 25 (если нужно)
  if (major >= 25) {
    return "java25";
  }
  if (major >= 20) {
    return "java21";
  }
  if (major >= 16) {
    return "java17";
  }
  return "java8";
}

function isRuleApplicable(rules: any[]): boolean {
  if (!rules || rules.length === 0) return true;

  let allowed = false;

  const osName = process.platform === "win32"
    ? "windows"
    : process.platform === "darwin"
    ? "osx"
    : "linux";

  for (const rule of rules) {
    let applies = true;

    if (rule.os?.name && rule.os.name !== osName) {
      applies = false;
    }

    if (applies) {
      allowed = rule.action === "allow";
    }
  }

  return allowed;
}

async function extractNativesFromJar(nativeJarPath: string, nativesDir: string): Promise<void> {
  try {
    const zip = new AdmZip(nativeJarPath);
    zip.extractAllTo(nativesDir, true);
    console.log(`[MurFlame] Extracted natives from ${path.basename(nativeJarPath)}`);
  } catch (e) {
    console.warn(`Failed to extract natives from ${nativeJarPath}:`, e);
  }
}

async function loadLibrariesFromJson(versionJson: any, gameDir: string, nativesDir: string, visited: Set<string>): Promise<string[]> {
  const classpath: string[] = [];
  const rawLibraries = versionJson.libraries || [];
  
  const librariesMap = new Map<string, any>();
  for (const lib of rawLibraries) {
    if (lib.rules && !isRuleApplicable(lib.rules)) {
      continue;
    }
    
    if (lib.name) {
      const parts = lib.name.split(":");
      let key = lib.name;
      if (parts.length >= 4) {
        key = `${parts[0]}:${parts[1]}:${parts[3]}`;
      } else if (parts.length >= 2) {
        key = `${parts[0]}:${parts[1]}`;
      }
      librariesMap.set(key, lib);
    } else {
      librariesMap.set(JSON.stringify(lib), lib);
    }
  }
  
  const libraries = Array.from(librariesMap.values());
  
  for (const lib of libraries) {
    const libKey = lib.name || JSON.stringify(lib);
    if (visited.has(libKey)) continue;
    visited.add(libKey);
    
    const libPath = await downloadLibraryJar(lib, gameDir);
    if (libPath && existsSync(libPath) && !classpath.includes(libPath)) {
      classpath.push(libPath);
      console.log(`[MurFlame] Added library: ${path.basename(libPath)}`);
    }
    
    if (lib.natives) {
      const osKey = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "osx" : "linux";
      const nativeKey = lib.natives[osKey]?.replace("${arch}", process.arch === "x64" ? "64" : "32");
      
      if (nativeKey) {
        let nativeJarPath = "";
        let nativeUrl: string | null = null;
        
        if (lib.downloads?.classifiers?.[nativeKey]) {
          nativeJarPath = lib.downloads.classifiers[nativeKey].path;
          nativeUrl = lib.downloads.classifiers[nativeKey].url;
        } else if (lib.name) {
          nativeJarPath = mavenPath(`${lib.name}:${nativeKey}`);
        }
        
        if (nativeJarPath) {
          const dest = path.join(gameDir, "libraries", nativeJarPath);
          let nativeJarExists = existsSync(dest);
          
          if (!nativeJarExists) {
            try {
              if (nativeUrl) {
                await downloadFile(nativeUrl, dest);
                nativeJarExists = true;
              } else if (lib.name) {
                const downloaded = await downloadWithFallback(nativeJarPath, gameDir);
                if (downloaded && existsSync(downloaded)) {
                  nativeJarExists = true;
                }
              }
            } catch (e) {
              console.warn(`[MurFlame] Failed to download native jar ${nativeJarPath}:`, e);
            }
          }
          
          if (nativeJarExists && existsSync(dest)) {
            await extractNativesFromJar(dest, nativesDir);
            
            const mcVersion = getMcVersion(versionJson.id);
            if (getMajorVersion(mcVersion) >= 13 && !classpath.includes(dest)) {
              classpath.push(dest);
              console.log(`[MurFlame] Added native JAR to classpath (LWJGL 3): ${path.basename(dest)}`);
            }
          }
        }
      }
    }
  }
  
  return classpath;
}

async function loadVersionJson(versionId: string, gameDir: string): Promise<any> {
  const versionDir = path.join(gameDir, "versions", versionId);
  const jsonPath = path.join(versionDir, `${versionId}.json`);
  
  if (!existsSync(jsonPath)) {
    throw new Error(`Version JSON not found: ${jsonPath}`);
  }
  
  const versionJson = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
  
  // Если нет libraries, создаём пустой массив
  if (!versionJson.libraries) {
    versionJson.libraries = [];
  }
  
  let parentJson = null;
  if (versionJson.inheritsFrom) {
    parentJson = await loadVersionJson(versionJson.inheritsFrom, gameDir);
  }
  
  const mergedLibraries = [
    ...(parentJson?.libraries || []),
    ...(versionJson.libraries || [])
  ];
  
  const mergedArguments = {
    jvm: [
      ...(parentJson?.arguments?.jvm || []),
      ...(versionJson.arguments?.jvm || [])
    ],
    game: [
      ...(parentJson?.arguments?.game || []),
      ...(versionJson.arguments?.game || [])
    ]
  };
  
  const mergedJson = {
    ...versionJson,
    libraries: mergedLibraries,
    arguments: mergedArguments,
    mainClass: versionJson.mainClass || parentJson?.mainClass || "net.minecraft.client.main.Main",
    minecraftArguments: versionJson.minecraftArguments || parentJson?.minecraftArguments,
    assetIndex: versionJson.assetIndex || parentJson?.assetIndex || { id: "legacy" },
    inheritsFrom: versionJson.inheritsFrom
  };
  
  return mergedJson;
}

// Запуск локального HTTP сервера для подмены скинов
function startSkinServer(gameDir: string, accountUuid: string, accountType?: string, skinUrl?: string, capeUrl?: string, localSkinPath?: string): Promise<number> {
  return new Promise((resolve, reject) => {
    if (skinServer) {
      skinServer.close();
      skinServer = null;
    }
    
    const skinsDir = path.join(gameDir, "skins");
    if (!existsSync(skinsDir)) {
      mkdirSync(skinsDir, { recursive: true });
    }
    
    const server = http.createServer(async (req, res) => {
      try {
        const url = req.url || "";
        
        // Запрос на получение скина по UUID
        if (url.includes("/skins/") || url.includes("/minecraftskins/")) {
          let uuid = url.split("/").pop()?.replace(".png", "") || "";
          
          let skinFile = path.join(skinsDir, `${uuid}.png`);
          if (localSkinPath && existsSync(localSkinPath)) {
            skinFile = localSkinPath;
          } else if (!existsSync(skinFile)) {
            try {
              let downloadUrl: string | undefined;
              if (accountType === "ely" && skinUrl) {
                downloadUrl = skinUrl;
              } else {
                downloadUrl = `https://mc-heads.net/skin/${uuid}`;
              }
              
              if (downloadUrl) {
                const response = await fetch(downloadUrl);
                if (response.ok) {
                  const buffer = Buffer.from(await response.arrayBuffer());
                  await fs.writeFile(skinFile, buffer);
                }
              }
            } catch (e) {
              console.warn(`[MurFlame] Failed to download skin: ${e}`);
            }
          }
          
          if (existsSync(skinFile)) {
            const skinBuffer = await fs.readFile(skinFile);
            res.writeHead(200, { 
              "Content-Type": "image/png",
              "Content-Length": skinBuffer.length
            });
            res.end(skinBuffer);
            return;
          }
        }
        
        // Запрос на получение профиля (подмена ответа для скинов)
        if (url.includes("/session/minecraft/profile/")) {
          const uuid = url.split("/").pop()?.split("?")[0] || "";
          
          let finalSkinUrl = `http://localhost:${(server.address() as any).port}/skins/${uuid}.png`;
          if (localSkinPath) {
            finalSkinUrl = `http://localhost:${(server.address() as any).port}/skins/${path.basename(localSkinPath)}`;
          }
          
          const textures: any = {
            SKIN: {
              url: finalSkinUrl,
              metadata: { model: "slim" }
            }
          };
          
          if (capeUrl) {
            textures.CAPE = { url: capeUrl };
          }
          
          const responseData = {
            id: uuid,
            name: "",
            properties: [
              {
                name: "textures",
                value: Buffer.from(JSON.stringify({
                  timestamp: Date.now(),
                  profileId: uuid,
                  profileName: "",
                  textures: textures
                })).toString("base64")
              }
            ]
          };
          
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(responseData));
          return;
        }
        
        // Запрос на получение скина по URL
        if (url.includes("/textures/") || url.includes("/skin/")) {
          if (localSkinPath && existsSync(localSkinPath)) {
            const skinBuffer = await fs.readFile(localSkinPath);
            res.writeHead(200, { "Content-Type": "image/png" });
            res.end(skinBuffer);
            return;
          }
        }
        
        res.writeHead(404);
        res.end();
      } catch (err) {
        console.error("[MurFlame] Skin server error:", err);
        res.writeHead(500);
        res.end();
      }
    });
    
    server.on("error", (err) => {
      console.error("[MurFlame] Skin server error:", err);
      reject(err);
    });
    
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as any).port;
      skinServer = server;
      skinServerPort = port;
      console.log(`[MurFlame] Skin server started on port ${port}`);
      resolve(port);
    });
  });
}

async function launchMinecraft(
  versionId: string,
  instancePath: string,
  gameDir: string,
  javaPath: string,
  minMemory: number,
  maxMemory: number,
  username: string,
  accessToken: string,
  send: ProgressSender,
  accountUuid?: string,
  accountType?: string,
  accountSkinUrl?: string,
  accountCapeUrl?: string,
  skinPath?: string
): Promise<ChildProcess> {
console.log(`[MurFlame] Launching Minecraft ${versionId}`);

console.log("[MurFlame] Working directory:", instancePath);
console.log("[MurFlame] Assets directory:", path.join(gameDir, "assets"));
  
  const versionJson = await loadVersionJson(versionId, gameDir);
  const mcVersion = getMcVersion(versionId);
  const isForge = versionId.includes("forge");
  const isFabric = versionId.includes("fabric");
  const isModernForge = isForge && getMajorVersion(mcVersion) >= 13;
  
  console.log(`[MurFlame] Modern Forge (1.13+): ${isModernForge}`);
  console.log(`[MurFlame] Fabric: ${isFabric}`);
  
  const versionDir = path.join(gameDir, "versions", versionId);
  const nativesDir = path.join(versionDir, "natives");
  if (!existsSync(nativesDir)) {
    mkdirSync(nativesDir, { recursive: true });
  }
  
  // Запускаем сервер подмены скинов (если есть UUID)
  let skinServerPort = 0;
  if (accountUuid) {
    try {
      skinServerPort = await startSkinServer(gameDir, accountUuid, accountType, accountSkinUrl, accountCapeUrl, skinPath);
    } catch (err) {
      console.warn("[MurFlame] Failed to start skin server:", err);
    }
  }
  
  sendDefault(send, { stage: "libraries", percent: 60, message: "Загрузка библиотек..." });
  
  const classpathList = await loadLibrariesFromJson(versionJson, gameDir, nativesDir, new Set());
  
  const isBootstrapLauncher = versionJson.mainClass === "cpw.mods.bootstraplauncher.BootstrapLauncher";
  if (!isBootstrapLauncher) {
    const clientJarVersion = versionJson.inheritsFrom || versionId;
    const clientJar = path.join(gameDir, "versions", clientJarVersion, `${clientJarVersion}.jar`);
    if (existsSync(clientJar)) {
      classpathList.push(clientJar);
      console.log(`[MurFlame] Added client JAR to classpath: ${clientJar}`);
    }
  }
  
  const cpSeparator = process.platform === "win32" ? ";" : ":";
  const classpathStr = classpathList.join(cpSeparator);
  
  console.log(`[MurFlame] Classpath Length: ${classpathList.length} libraries`);
  console.log(`[MurFlame] First 20 Libraries:`);
  classpathList.slice(0, 20).forEach(lib => {
    console.log(`- ${path.basename(lib)}`);
  });
  
  sendDefault(send, { stage: "launch", percent: 70, message: "Формирование аргументов..." });
  
  const assetIndex = versionJson.assetIndex?.id || "legacy";
  
  const jvmArgs: string[] = [
    `-Xms${minMemory}M`,
    `-Xmx${maxMemory}M`,
    `-Djava.library.path=${nativesDir}`,
  ];
  
  if (versionJson.arguments?.jvm && versionJson.arguments.jvm.length > 0) {
    for (const arg of versionJson.arguments.jvm) {
      if (typeof arg === "string") {
        let processed = arg;
        processed = processed.replace(/\${library_directory}/g, path.join(gameDir, "libraries"));
        processed = processed.replace(/\${classpath}/g, classpathStr);
        processed = processed.replace(/\${classpath_separator}/g, cpSeparator);
        processed = processed.replace(/\${natives_directory}/g, nativesDir);
        jvmArgs.push(processed);
      }
    }
  } else if (!isModernForge) {
    jvmArgs.push("-Dfml.ignoreInvalidMinecraftCertificates=true");
    jvmArgs.push("-Dfml.ignorePatchDiscrepancies=true");
  }
  
  jvmArgs.push("-cp", classpathStr);
  
  const mainClass = versionJson.mainClass || "net.minecraft.client.main.Main";
  jvmArgs.push(mainClass);
  
  // ============ НОВЫЙ ПОДХОД: полностью пересоздаём gameArgs без дубликатов ============
  let gameArgs: string[] = [];
  
  // Пропускаем добавление аргументов из versionJson, чтобы избежать дублирования
  // Вместо этого полностью полагаемся на секцию "АРГУМЕНТЫ ДЛЯ СКИНОВ И АУТЕНТИФИКАЦИИ"
  
  // ============ АРГУМЕНТЫ ДЛЯ СКИНОВ И АУТЕНТИФИКАЦИИ ============
  if (!isModernForge) {
    // Создаём ЧИСТЫЙ массив аргументов (без дубликатов)
    const freshGameArgs: string[] = [];
    
    // Добавляем ВСЕ аргументы в правильном порядке
    freshGameArgs.push("--username", username || "Player");
    freshGameArgs.push("--version", versionId);
    freshGameArgs.push("--gameDir", instancePath);
    freshGameArgs.push("--assetsDir", path.join(gameDir, "assets"));
    freshGameArgs.push("--assetIndex", assetIndex);
    
    // Аутентификационные аргументы
    freshGameArgs.push("--uuid", accountUuid || "00000000-0000-0000-0000-000000000000");
    freshGameArgs.push("--accessToken", accessToken || "0");
    freshGameArgs.push("--userType", "mojang");
    freshGameArgs.push("--versionType", "release");
    
    // Добавляем аргументы для подмены скинов (если запущен сервер)
    if (skinServerPort > 0) {
      // Подмена API сервера скинов
      jvmArgs.unshift(`-Dminecraft.api.auth.host=http://localhost:${skinServerPort}`);
      jvmArgs.unshift(`-Dminecraft.api.account.host=http://localhost:${skinServerPort}`);
      jvmArgs.unshift(`-Dminecraft.api.session.host=http://localhost:${skinServerPort}`);
      jvmArgs.unshift(`-Dminecraft.api.services.host=http://localhost:${skinServerPort}`);
      
      // Подмена URL для скинов
      freshGameArgs.push("--skinHost", `http://localhost:${skinServerPort}`);
    }
    
    // Для старых версий
    if (getMajorVersion(mcVersion) === 7) {
      freshGameArgs.push("--userProperties", "{}");
    }
    
    // Добавляем tweakClass если нужно
    if (isForge && !isModernForge) {
      const tweakClass = getMajorVersion(mcVersion) >= 12
        ? "net.minecraftforge.fml.common.launcher.FMLTweaker"
        : "cpw.mods.fml.common.launcher.FMLTweaker";
      
      const hasTweakClass = freshGameArgs.includes("--tweakClass");
      if (!hasTweakClass) {
        freshGameArgs.unshift("--tweakClass", tweakClass);
      }
    }
    
    gameArgs = freshGameArgs;
  }
  // ==============================================================
  
  const allArgs = [...jvmArgs, ...gameArgs];
  
  console.log(`[MurFlame] Java: ${javaPath}`);
  console.log(`[MurFlame] Main class: ${mainClass}`);
  console.log(`[MurFlame] Game arguments count: ${gameArgs.length}`);
  console.log(`[MurFlame] Total arguments: ${allArgs.length}`);
  
  sendDefault(send, { stage: "launch", percent: 90, message: "Запуск Minecraft..." });
  
  const child = spawn(javaPath, allArgs, {
    cwd: instancePath,
    env: {
      ...process.env,
      JAVA_HOME: path.dirname(path.dirname(javaPath)),
    },
    stdio: ["ignore", "ignore", "ignore"],
    detached: true,
    windowsVerbatimArguments: false
  });
  
  // Отсоединяем дочерний процесс от родительского
  child.unref();
  
// Отправляем статус, что игра запущена
if (process.send) {
  process.send({ type: "game-status", isRunning: true });
}

if (process.send) {
  process.send({ type: "game-status", isRunning: false });
}
  
  child.on("close", (code) => {
    console.log(`[MurFlame] Minecraft exited with code ${code}`);
    currentGameProcess = null;
    sendDefault(send, { stage: "closed", percent: 100, message: `Игра закрыта` });
    
    // Закрываем сервер скинов
    if (skinServer) {
      skinServer.close();
      skinServer = null;
      skinServerPort = 0;
    }

if (process.send) {
  process.send({ type: "game-closed" });
    }
  });
  
  child.on("error", (err) => {
    console.error(`[MurFlame] Process error: ${err}`);
    currentGameProcess = null;
  });
  
  currentGameProcess = child;
  
  return child;
}

async function installForgeProperly(
  mcVersion: string,
  forgeVersion: string,
  gameDir: string,
  javaPath: string,
  send: ProgressSender
): Promise<string> {
  const versionId = `${mcVersion}-forge-${forgeVersion}`;
  const versionDir = path.join(gameDir, "versions", versionId);
  const jsonPath = path.join(versionDir, `${versionId}.json`);
  
  sendDefault(send, { stage: "modloader", percent: 20, message: `Установка Forge ${forgeVersion}...` });
  
  const vanillaJsonPath = path.join(gameDir, "versions", mcVersion, `${mcVersion}.json`);
  if (!existsSync(vanillaJsonPath)) {
    await installVanillaVersion(mcVersion, gameDir);
  }
  
  mkdirSync(versionDir, { recursive: true });
  
  try {
    let installerPath = `net/minecraftforge/forge/${mcVersion}-${forgeVersion}/forge-${mcVersion}-${forgeVersion}-installer.jar`;
    const major = getMajorVersion(mcVersion);
    if (major === 7 || major === 8) {
      const duplicatedPath = `net/minecraftforge/forge/${mcVersion}-${forgeVersion}-${mcVersion}/forge-${mcVersion}-${forgeVersion}-${mcVersion}-installer.jar`;
      const standardPath = `net/minecraftforge/forge/${mcVersion}-${forgeVersion}/forge-${mcVersion}-${forgeVersion}-installer.jar`;
      
      let duplicatedExists = false;
      try {
        const res = await fetch(`https://maven.minecraftforge.net/${duplicatedPath}`, { method: "HEAD" });
        if (res.ok) {
          duplicatedExists = true;
        }
      } catch (e) {
        try {
          const res = await fetch(`https://bmclapi2.bangbang93.com/maven/${duplicatedPath}`, { method: "HEAD" });
          if (res.ok) {
            duplicatedExists = true;
          }
        } catch (e2) {}
      }
      
      if (duplicatedExists) {
        installerPath = duplicatedPath;
        console.log(`[MurFlame] Using duplicated suffix path for Forge: ${installerPath}`);
      } else {
        installerPath = standardPath;
        console.log(`[MurFlame] Using standard path for Forge: ${installerPath}`);
      }
    }

    const installedId = await installForge(
      {
        mcversion: mcVersion,
        version: forgeVersion,
        installer: {
          path: installerPath
        }
      },
      gameDir,
      {
        java: javaPath,
        mavenHost: ["https://bmclapi2.bangbang93.com/maven", "https://maven.minecraftforge.net/"]
      }
    );
    console.log(`[MurFlame] Forge installed successfully via installer. Installed ID: ${installedId}`);
    
    if (installedId && installedId !== versionId) {
      const installedDir = path.join(gameDir, "versions", installedId);
      const installedJsonPath = path.join(installedDir, `${installedId}.json`);
      
      if (existsSync(installedDir)) {
        if (existsSync(versionDir) && versionDir !== installedDir) {
          await fs.rm(versionDir, { recursive: true, force: true });
        }
        
        if (existsSync(installedJsonPath)) {
          await fs.rename(installedJsonPath, path.join(installedDir, `${versionId}.json`));
        }
        
        await fs.rename(installedDir, versionDir);
        console.log(`[MurFlame] Renamed Forge folder from ${installedId} to ${versionId}`);
      }
    }
  } catch (error) {
    console.error(`[MurFlame] Forge installation failed:`, error);
    throw new Error(`Не удалось установить Forge: ${error}`);
  }
  
  if (!existsSync(jsonPath)) {
    throw new Error(`Forge JSON not created at ${jsonPath}`);
  }
  
  const installedJson = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
  console.log(`[MurFlame] Forge JSON mainClass: ${installedJson.mainClass || "not set"}`);
  
  sendDefault(send, { stage: "modloader", percent: 60, message: "Forge установлен!" });
  
  return versionId;
}

async function installFabricProperly(
  mcVersion: string,
  loaderVersion: string,
  gameDir: string,
  send: ProgressSender
): Promise<string> {
  sendDefault(send, { stage: "modloader", percent: 20, message: `Установка Fabric...` });
  
  try {
    const versionId = await installFabric({
      minecraftVersion: mcVersion,
      version: loaderVersion,
      minecraft: gameDir
    });
    console.log(`[MurFlame] Fabric installed successfully: ${versionId}`);
    sendDefault(send, { stage: "modloader", percent: 60, message: "Fabric установлен!" });
    return versionId;
  } catch (error) {
    console.error(`[MurFlame] Fabric installation failed:`, error);
    throw new Error(`Не удалось установить Fabric: ${error}`);
  }
}

export async function runLaunchGame(
  versionId: string,
  instancePath: string,
  resourcePath: string,
  send: ProgressSender,
  loader?: string,
  username?: string,
  accessToken?: string,
  accountUuid?: string,
  accountType?: string,
  accountSkinUrl?: string,
  accountCapeUrl?: string,
  skinPath?: string
) {
  if (!versionId) throw new Error("Не выбрана версия");

  console.log(`[MurFlame] Запуск версии: ${versionId}`);

  let vanillaVersion = getMcVersion(versionId);
  let forgeVersion = "";
  let fabricVersion = "";
  
  if (versionId.includes("-forge-")) {
    const parts = versionId.split("-forge-");
    vanillaVersion = parts[0];
    forgeVersion = parts[1];
  } else if (versionId.includes("fabric-loader-")) {
    const match = versionId.match(/fabric-loader-(\d+\.\d+\.\d+)-(.+)/);
    if (match) {
      fabricVersion = match[1];
      vanillaVersion = match[2];
    }
  }

  const isForge = loader === "forge" || (forgeVersion !== "" && versionId.includes("forge"));
  const isFabric = loader === "fabric" || versionId.includes("fabric");
  
  // Проверяем, является ли версия кастомной
  const isCustomVersion = versionId === "custom" || 
                          versionId.startsWith("alpha-") || 
                          versionId.includes("remastered") ||
                          vanillaVersion === "custom" ||
                          vanillaVersion === "alpha";

  // Для кастомных версий создаём базовый JSON если его нет
  if (isCustomVersion) {
    const customVersionDir = path.join(resourcePath, "versions", versionId);
    const customJsonPath = path.join(customVersionDir, `${versionId}.json`);
    
    if (!existsSync(customJsonPath)) {
      console.log("[MurFlame] Создаём базовый JSON для кастомной версии");
      await fs.mkdir(customVersionDir, { recursive: true });
      
      // Создаём минимальный JSON для версии
      const customJson = {
        id: versionId,
        mainClass: "net.minecraft.client.main.Main",
        minecraftArguments: "--username ${auth_player_name} --version ${version_name} --gameDir ${game_directory} --assetsDir ${assets_root}",
        libraries: [],
        downloads: {
          client: {
            url: "",
            sha1: "",
            size: 0
          }
        },
        assetIndex: {
          id: "legacy",
          url: ""
        }
      };
      
      await fs.writeFile(customJsonPath, JSON.stringify(customJson, null, 2));
    }
  }

  // Автоматически заменяем старые нестабильные версии Forge на рекомендуемые
  if (isForge && RECOMMENDED_FORGE_VERSIONS[vanillaVersion]) {
    const recommendedVersion = RECOMMENDED_FORGE_VERSIONS[vanillaVersion];
    if (!forgeVersion || forgeVersion !== recommendedVersion) {
      console.log(`[MurFlame] Replacing old Forge version ${forgeVersion || "unknown"} with recommended ${recommendedVersion} for ${vanillaVersion}`);
      forgeVersion = recommendedVersion;
      versionId = `${vanillaVersion}-forge-${forgeVersion}`;
    }
  }
  
  sendDefault(send, { stage: "launch", percent: 5, message: "Подготовка..." });

  const normalizedInstancePath = path.resolve(instancePath);
  
  // Пропускаем установку ванильной версии для кастомных сборок
  if (!isCustomVersion) {
    const vanillaDir = path.join(resourcePath, "versions", vanillaVersion);
    if (!existsSync(vanillaDir)) {
      sendDefault(send, { stage: "vanilla", percent: 10, message: "Установка ванильной версии..." });
      await installVanillaVersion(vanillaVersion, resourcePath);
    }
  } else {
    console.log("[MurFlame] Кастомная версия, пропускаем установку ванильной версии");
  }

  let javaPath = "";
  const requiredJava = getRequiredJavaVersion(versionId);
  
  try {
    javaPath = getJavaRuntimePath(requiredJava, resourcePath);
    if (!javaPath) {
      sendDefault(send, { stage: "java", percent: 30, message: `Скачиваем Java ${requiredJava}...` });
      javaPath = await ensureJavaRuntime(requiredJava, resourcePath, (m) =>
        sendDefault(send, { stage: "java", percent: 40, message: m })
      );
    }
  } catch (javaErr) {
    throw new Error(`Не удалось подобрать Java! ${(javaErr as Error).message}`);
  }

  sendDefault(send, { stage: "launch", percent: 50, message: "Java готова!" });

  let finalVersionId = versionId;
  
  if (!isCustomVersion) {
    if (isForge) {
      const forgeJsonPath = path.join(resourcePath, "versions", finalVersionId, `${finalVersionId}.json`);
      
      let needsInstall = !existsSync(forgeJsonPath);
      if (!needsInstall) {
        try {
          const stats = await fs.stat(forgeJsonPath);
          if (stats.size < 100) {
            needsInstall = true;
          } else {
            const content = JSON.parse(await fs.readFile(forgeJsonPath, "utf-8"));
            if (!content.libraries || content.libraries.length < 5) {
              needsInstall = true;
            }
          }
        } catch {
          needsInstall = true;
        }
      }
      
      if (needsInstall) {
        await installForgeProperly(vanillaVersion, forgeVersion, resourcePath, javaPath, send);
      }
    } else if (isFabric) {
      const fabricJsonPath = path.join(resourcePath, "versions", finalVersionId, `${finalVersionId}.json`);
      
      let needsInstall = !existsSync(fabricJsonPath);
      if (!needsInstall) {
        try {
          const stats = await fs.stat(fabricJsonPath);
          if (stats.size < 100) {
            needsInstall = true;
          } else {
            const content = JSON.parse(await fs.readFile(fabricJsonPath, "utf-8"));
            if (!content.libraries || content.libraries.length < 5) {
              needsInstall = true;
            }
          }
        } catch {
          needsInstall = true;
        }
      }
      
      if (needsInstall) {
        const loaderVersion = fabricVersion || "0.15.11";
        finalVersionId = await installFabricProperly(vanillaVersion, loaderVersion, resourcePath, send);
      }
    }
  }

  const memorySettings = await getMemorySettings();
  let minMemory = Math.max(512, Math.min(memorySettings.minMemory || 512, 4096));
  let maxMemory = Math.max(1024, Math.min(memorySettings.maxMemory || 4096, 16384));
  
  sendDefault(send, { stage: "launch", percent: 80, message: "Запуск..." });

  return await launchMinecraft(
    finalVersionId,
    normalizedInstancePath,
    resourcePath,
    javaPath,
    minMemory,
    maxMemory,
    username || "Player",
    accessToken || "0",
    send,
    accountUuid,
    accountType,
    accountSkinUrl,
    accountCapeUrl,
    skinPath
  );
}

export function killGameProcess(): boolean {
  if (currentGameProcess && !currentGameProcess.killed) {
    if (process.platform === "win32" && currentGameProcess.pid) {
      exec(`taskkill /pid ${currentGameProcess.pid} /f /t`);
    } else {
      currentGameProcess.kill('SIGKILL');
    }
    currentGameProcess = null;
    return true;
  }
  return false;
}

export function isGameRunning(): boolean {
  return currentGameProcess !== null && !currentGameProcess.killed;
}