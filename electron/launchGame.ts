import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { launch, Version } from "@xmcl/core";
import {
  installFabric,
  installQuiltVersion,
  installForge,
  installNeoForged,
} from "@xmcl/installer";
import { getJavaRuntimePath, ensureJavaRuntime } from "./java.js";
import type { LaunchProgress } from "./types.js";

type ProgressSender = (p: LaunchProgress) => void;

// Глобальное объявление для настроек
declare global {
  var __launcherSettings: { minMemory: number; maxMemory: number };
}

function mcMajorVersion(versionId: string): number {
  const match = versionId.match(/^(\d+)\.(\d+)/);
  if (!match) return 21;
  const major = parseInt(match[1]);
  const minor = parseInt(match[2]);
  return major === 1 ? minor : major;
}

function sendDefault(sender: ProgressSender, p: Partial<LaunchProgress>) {
  sender({ stage: "launch", percent: 0, message: "", ...p } as LaunchProgress);
}

async function installVanillaVersion(versionId: string, gameDir: string) {
  let vanillaVersion = versionId;

  if (vanillaVersion.startsWith("fabric-loader-") || vanillaVersion.startsWith("quilt-loader-")) {
    vanillaVersion = vanillaVersion.split("-").pop() || versionId;
  } else if (vanillaVersion.includes("-forge-") || vanillaVersion.includes("-neoforge-")) {
    vanillaVersion = vanillaVersion.split("-")[0];
  }

  console.log(`[MurFlame] Installing vanilla version: ${vanillaVersion} (from ${versionId})`);

  const manifestUrl = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
  const manifest = await fetch(manifestUrl).then((r) => r.json());
  const version = manifest.versions.find((v: any) => v.id === vanillaVersion);

  if (!version) {
    throw new Error(`Vanilla version ${vanillaVersion} not found in manifest`);
  }

  const versionJson = await fetch(version.url).then((r) => r.json());
  const versionDir = path.join(gameDir, "versions", vanillaVersion);
  await fs.mkdir(versionDir, { recursive: true });

  const jsonPath = path.join(versionDir, `${vanillaVersion}.json`);
  if (!existsSync(jsonPath)) {
    await fs.writeFile(jsonPath, JSON.stringify(versionJson, null, 2));
  }

  const clientJar = path.join(versionDir, `${vanillaVersion}.jar`);
  if (!existsSync(clientJar)) {
    console.log(`[MurFlame] Downloading client for ${vanillaVersion}...`);
    const response = await fetch(versionJson.downloads.client.url);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(clientJar, buffer);
  }

  console.log(`[MurFlame] Vanilla version ${vanillaVersion} installed successfully`);
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

  console.log(`[MurFlame] Запуск версии: ${versionId} с лоадером: ${loader || "vanilla"}`);
  console.log(`[MurFlame] instancePath: ${instancePath}`);
  console.log(`[MurFlame] resourcePath: ${resourcePath}`);

  sendDefault(send, { stage: "launch", percent: 5, message: "Подготовка к запуску…" });

  let baseVersion = versionId;
  if (versionId.startsWith("fabric-loader-") || versionId.startsWith("quilt-loader-")) {
    baseVersion = versionId.split("-").pop() || versionId;
  } else if (versionId.includes("-forge-")) {
    baseVersion = versionId.split("-")[0];
  } else if (versionId.includes("-neoforge-")) {
    baseVersion = versionId.split("-")[0];
  }
  console.log(`[MurFlame] Base version extracted: ${baseVersion} from ${versionId}`);

  const vanillaVersionDir = path.join(resourcePath, "versions", baseVersion);
  if (!existsSync(vanillaVersionDir)) {
    sendDefault(send, { stage: "vanilla", percent: 10, message: "Установка ванильной версии..." });
    await installVanillaVersion(baseVersion, resourcePath);
  }

  const loaderVersionDir = path.join(resourcePath, "versions", versionId);
  if (!existsSync(loaderVersionDir)) {
    if (loader && loader !== "vanilla") {
      sendDefault(send, { stage: "modloader", percent: 20, message: `Установка ${loader}...` });
      console.warn(`[MurFlame] Лоадер ${loader} не установлен для версии ${versionId}`);
    }
  }

  let javaPath = "";
  let requiredJava: "java8" | "java17" | "java21" = "java17";
  try {
    const major = mcMajorVersion(baseVersion);

    if (loader === "forge" && major <= 16) {
      requiredJava = "java17";
      console.log(`[MurFlame] Forge ${baseVersion} использует Java 17`);
    } else if (major <= 12) {
      requiredJava = "java8";
    } else if (major <= 16) {
      requiredJava = "java17";
    } else if (major <= 20) {
      requiredJava = "java17";
    } else {
      requiredJava = "java21";
    }

    console.log(
      `[MurFlame] Выбрана Java: ${requiredJava} для Minecraft ${baseVersion} (загрузчик: ${loader || "vanilla"}, major: ${major})`
    );

    javaPath = getJavaRuntimePath(requiredJava, resourcePath);
    if (!javaPath) {
      sendDefault(send, { stage: "java", percent: 30, message: `Скачиваем ${requiredJava}...` });
      javaPath = await ensureJavaRuntime(requiredJava, resourcePath, (m) =>
        sendDefault(send, { stage: "java", percent: 50, message: m })
      );
    }
    console.log("[MurFlame] Используется Java:", javaPath);
  } catch (javaErr) {
    console.error("[MurFlame] Java ошибка:", javaErr);
    throw new Error(`Не удалось подобрать Java! ${(javaErr as Error).message}`);
  }

  sendDefault(send, { stage: "launch", percent: 60, message: "Java готова!" });

  const memorySettings = await getMemorySettings();

  let minMemory = Math.max(256, Math.min(memorySettings.minMemory || 512, 8192));
  let maxMemory = Math.max(1024, Math.min(memorySettings.maxMemory || 4096, 16384));

  if (minMemory > maxMemory) {
    minMemory = maxMemory - 256;
    if (minMemory < 256) minMemory = 256;
  }

  console.log(`[MurFlame] Настройки памяти: min=${minMemory}MB, max=${maxMemory}MB`);

  const extraJvmArgs: string[] = [];
  if (loader === "forge" && requiredJava === "java17") {
    extraJvmArgs.push(
      "--add-opens",
      "java.base/java.util.jar=ALL-UNNAMED",
      "--add-opens",
      "java.base/java.lang=ALL-UNNAMED",
      "--add-opens",
      "java.base/java.lang.invoke=ALL-UNNAMED",
      "--add-opens",
      "java.base/java.util=ALL-UNNAMED",
      "--add-opens",
      "java.base/sun.security.util=ALL-UNNAMED"
    );
    console.log("[MurFlame] Добавлены JVM аргументы для совместимости Forge с Java 17");
  }

  const uuid = "00000000-0000-0000-0000-000000000000";
  const playerName = username || "Player";
  const token = accessToken || "";

  const launchOptions = {
    gamePath: instancePath,
    resourcePath: resourcePath,
    version: versionId,
    javaPath: javaPath,
    minMemory: minMemory,
    maxMemory: maxMemory,
    gameProfile: { name: playerName, id: uuid },
    accessToken: token,
    userType: "legacy" as const,
    ignoreInvalidMinecraftCertificates: true,
    ignorePatchDiscrepancies: true,
    demo: false,
    launcherName: "murflame",
    launcherBrand: "MurFlame",
    extraJvmArgs: extraJvmArgs,
  };

  sendDefault(send, { stage: "launch", percent: 90, message: "Запуск Minecraft..." });

  try {
    const child = await launch(launchOptions);

    const logFile = path.join(instancePath, "logs", "latest.log");
    await fs.mkdir(path.dirname(logFile), { recursive: true });
    const logFd = await fs.open(logFile, "w");

    if (child.stdout) {
      child.stdout.on("data", (b) => {
        const s = b.toString();
        console.log(`[Minecraft] ${s}`);
        fs.writeFile(logFd, s, { flag: "a" }).catch(console.error);
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (b) => {
        const s = b.toString();
        console.error(`[Minecraft Error] ${s}`);
        fs.writeFile(logFd, s, { flag: "a" }).catch(console.error);
      });
    }

    child.on("close", (code) => {
      console.log(`[MurFlame] Игра закрылась (код: ${code})`);
      logFd.close().catch(console.error);
    });

    sendDefault(send, { stage: "running", percent: 100, message: "Игра запущена!" });
    return child;
  } catch (error) {
    console.error("[MurFlame] Launch error:", error);
    throw new Error(`Ошибка запуска: ${(error as Error).message}`);
  }
}