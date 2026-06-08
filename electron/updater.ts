// electron/updater.ts
import { BrowserWindow, dialog, shell } from "electron";
import fs from "fs/promises";
import path from "path";
import https from "https";

const CURRENT_VERSION = "1.0.0"; // Обновляйте при каждом релизе

interface VersionInfo {
  version: string;
  releaseDate: string;
  downloadUrl: string;
  changelog: string;
}

export async function checkForUpdates(mainWindow: BrowserWindow): Promise<void> {
  try {
    console.log("[Updater] Checking for updates...");
    
    const response = await fetch("https://raw.githubusercontent.com/ваш-username/murflame-launcher/main/version.json");
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const remoteVersion = await response.json() as VersionInfo;
    
    console.log(`[Updater] Current version: ${CURRENT_VERSION}, Remote version: ${remoteVersion.version}`);
    
    if (remoteVersion.version !== CURRENT_VERSION) {
      console.log("[Updater] Update available!");
      
      const result = await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Доступно обновление!",
        message: `Доступна новая версия ${remoteVersion.version}`,
        detail: `Что нового:\n${remoteVersion.changelog}`,
        buttons: ["Обновить сейчас", "Напомнить позже"],
        defaultId: 0,
        cancelId: 1,
      });
      
      if (result.response === 0) {
        await shell.openExternal(remoteVersion.downloadUrl);
        return;
      }
    } else {
      console.log("[Updater] No updates available");
    }
  } catch (error) {
    console.error("[Updater] Failed to check for updates:", error);
  }
}

export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}