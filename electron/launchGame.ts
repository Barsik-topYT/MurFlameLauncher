import fs from "fs/promises";
import path from "path";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { spawn, ChildProcess, exec } from "child_process";
import { getJavaRuntimePath, ensureJavaRuntime } from "./java.js";
import type { LaunchProgress } from "./types.js";
import { installForge, installFabric } from "@xmcl/installer";
import iconv from "iconv-lite";
import AdmZip from "adm-zip";

type ProgressSender = (p: LaunchProgress) => void;

declare global {
  var __launcherSettings: { minMemory: number; maxMemory: number };
}

let currentGameProcess: ChildProcess | null = null;

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
  return versionId.split("-")[0];
}

function getMajorVersion(versionId: string): number {
  const mcVersion = getMcVersion(versionId);
  const parts = mcVersion.split(".");
  return parseInt(parts[1] || parts[0] || "0");
}

function getRequiredJavaVersion(versionId: string): "java8" | "java17" | "java21" {
  const major = getMajorVersion(versionId);
  
  if (major >= 18) {
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
    assetIndex: versionJson.assetIndex || parentJson?.assetIndex,
    inheritsFrom: versionJson.inheritsFrom
  };
  
  return mergedJson;
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
  send: ProgressSender
): Promise<ChildProcess> {
  console.log(`[MurFlame] Launching Minecraft ${versionId}`);
  
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
  
  console.log(`[MurFlame] Classpath length: ${classpathList.length} libraries`);
  console.log(`[MurFlame] First 20 libraries:`);
  classpathList.slice(0, 20).forEach(lib => {
    console.log(`  - ${path.basename(lib)}`);
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
  
  let gameArgs: string[] = [];
  
  if (versionJson.arguments?.game && versionJson.arguments.game.length > 0) {
    for (const arg of versionJson.arguments.game) {
      if (typeof arg === "string") {
        let processed = arg;
        processed = processed.replace(/\${auth_player_name}/g, username);
        processed = processed.replace(/\${version_name}/g, versionId);
        processed = processed.replace(/\${game_directory}/g, instancePath);
        processed = processed.replace(/\${assets_root}/g, path.join(gameDir, "assets"));
        processed = processed.replace(/\${assets_index_name}/g, assetIndex);
        processed = processed.replace(/\${auth_uuid}/g, "00000000-0000-0000-0000-000000000000");
        processed = processed.replace(/\${auth_access_token}/g, accessToken);
        processed = processed.replace(/\${user_type}/g, "legacy");
        processed = processed.replace(/\${version_type}/g, "release");
        processed = processed.replace(/\${library_directory}/g, path.join(gameDir, "libraries"));
        processed = processed.replace(/\${classpath}/g, classpathStr);
        processed = processed.replace(/\${classpath_separator}/g, cpSeparator);
        processed = processed.replace(/\${natives_directory}/g, nativesDir);
        gameArgs.push(processed);
      }
    }
  } else if (versionJson.minecraftArguments && !isModernForge) {
    let oldArgs = versionJson.minecraftArguments;
    oldArgs = oldArgs.replace(/\${auth_player_name}/g, username);
    oldArgs = oldArgs.replace(/\${version_name}/g, versionId);
    oldArgs = oldArgs.replace(/\${game_directory}/g, instancePath);
    oldArgs = oldArgs.replace(/\${assets_root}/g, path.join(gameDir, "assets"));
    oldArgs = oldArgs.replace(/\${assets_index_name}/g, assetIndex);
    oldArgs = oldArgs.replace(/\${auth_uuid}/g, "00000000-0000-0000-0000-000000000000");
    oldArgs = oldArgs.replace(/\${auth_access_token}/g, accessToken);
    oldArgs = oldArgs.replace(/\${user_type}/g, "legacy");
    oldArgs = oldArgs.replace(/\${version_type}/g, "release");
    gameArgs = oldArgs.split(" ");
  }
  
  if (!isModernForge) {
    const hasAccessToken = gameArgs.some(arg => arg === "--accessToken");
    if (!hasAccessToken) {
      gameArgs.push("--accessToken", accessToken || "0");
    }
    
    const hasUsername = gameArgs.some(arg => arg === "--username");
    if (!hasUsername) {
      gameArgs.unshift("--username", username || "Player");
    }
    
    const hasVersion = gameArgs.some(arg => arg === "--version");
    if (!hasVersion) {
      gameArgs.unshift("--version", versionId);
    }
    
    const hasGameDir = gameArgs.some(arg => arg === "--gameDir");
    if (!hasGameDir) {
      gameArgs.unshift("--gameDir", instancePath);
    }
    
    const hasAssetsDir = gameArgs.some(arg => arg === "--assetsDir");
    if (!hasAssetsDir) {
      gameArgs.unshift("--assetsDir", path.join(gameDir, "assets"));
    }
    
    const hasAssetIndex = gameArgs.some(arg => arg === "--assetIndex");
    if (!hasAssetIndex) {
      gameArgs.unshift("--assetIndex", assetIndex);
    }
    
    const hasUuid = gameArgs.some(arg => arg === "--uuid");
    if (!hasUuid) {
      gameArgs.unshift("--uuid", "00000000-0000-0000-0000-000000000000");
    }
    
    const hasUserType = gameArgs.some(arg => arg === "--userType");
    if (!hasUserType) {
      gameArgs.unshift("--userType", "legacy");
    }
    
    const hasVersionType = gameArgs.some(arg => arg === "--versionType");
    if (!hasVersionType) {
      gameArgs.unshift("--versionType", "release");
    }
    
    // Для 1.7.10 нужен правильный формат --userProperties
    if (getMajorVersion(mcVersion) === 7) {
      const userPropIndex = gameArgs.findIndex(arg => arg === "--userProperties");
      if (userPropIndex !== -1) {
        gameArgs.splice(userPropIndex, 2);
      }
      // Передаём пустой JSON объект как строку
      gameArgs.push("--userProperties", "{}");
    }
  }
  
  const allArgs = [...jvmArgs, ...gameArgs];
  
  console.log(`[MurFlame] Java: ${javaPath}`);
  console.log(`[MurFlame] Main class: ${mainClass}`);
  console.log(`[MurFlame] Total arguments: ${allArgs.length}`);
  
  sendDefault(send, { stage: "launch", percent: 90, message: "Запуск Minecraft..." });
  
  const child = spawn(javaPath, allArgs, {
    cwd: instancePath,
    env: {
      ...process.env,
      JAVA_HOME: path.dirname(path.dirname(javaPath)),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsVerbatimArguments: false
  });
  
  child.stdout?.on("data", (data) => {
    let output: string;
    if (process.platform === "win32") {
      output = iconv.decode(Buffer.from(data), "cp866");
    } else {
      output = data.toString();
    }
    console.log(`[Minecraft] ${output.trim()}`);
    
    if (output.includes("Loading") || output.includes("Starting") || 
        output.includes("Setting up") || output.includes("Environment") ||
        output.includes("ModLauncher") || output.includes("FML")) {
      sendDefault(send, { stage: "running", percent: 100, message: "Игра запущена!" });
    }
  });
  
  child.stderr?.on("data", (data) => {
    let output: string;
    if (process.platform === "win32") {
      output = iconv.decode(Buffer.from(data), "cp866");
    } else {
      output = data.toString();
    }
    console.error(`[Minecraft Error] ${output.trim()}`);
  });
  
  child.on("close", (code) => {
    console.log(`[MurFlame] Minecraft exited with code ${code}`);
    currentGameProcess = null;
    sendDefault(send, { stage: "closed", percent: 100, message: `Игра закрыта` });
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
  accessToken?: string
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
  
  const vanillaDir = path.join(resourcePath, "versions", vanillaVersion);
  if (!existsSync(vanillaDir)) {
    sendDefault(send, { stage: "vanilla", percent: 10, message: "Установка ванильной версии..." });
    await installVanillaVersion(vanillaVersion, resourcePath);
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
    send
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