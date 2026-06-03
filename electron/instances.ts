import path from "path";
import fs from "fs/promises";
import { existsSync, readdirSync } from "fs";
import { randomUUID } from "crypto";
import type { GameInstance, InstanceLoader, InstanceIcon } from "./types.js";

export function sanitizeFolderName(name: string): string {
  let sanitized = name.replace(/[<>:"/\\|?*]/g, "");
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, "");
  return sanitized.substring(0, 255) || "instance";
}

export function generateUniqueFolderName(baseName: string, existingNames: string[]): string {
  const sanitized = sanitizeFolderName(baseName);
  if (!existingNames.includes(sanitized)) {
    return sanitized;
  }
  let counter = 1;
  let newName;
  do {
    newName = `${sanitized} (${counter})`;
    counter++;
  } while (existingNames.includes(newName));
  return newName;
}

export function detectLoader(versionId: string): InstanceLoader {
  const id = versionId.toLowerCase();
  if (id.includes("neoforge")) return "neoforge";
  if (id.includes("forge") || id.includes("-forge-")) return "forge";
  if (id.includes("fabric")) return "fabric";
  if (id.includes("quilt")) return "quilt";
  if (id.includes("optifine")) return "optifine";
  return "vanilla";
}

export function detectMcVersion(versionId: string): string {
  const match = versionId.match(/^(\d+\.\d+(?:\.\d+)?)/);
  return match?.[1] ?? versionId;
}

export function instanceDir(gameDir: string, instanceNameOrId: string): string {
  return path.join(gameDir, "instances", instanceNameOrId);
}

export async function getInstanceFolder(gameDir: string, instance: GameInstance): Promise<string> {
  const folderName = sanitizeFolderName(instance.name);
  return path.join(gameDir, "instances", folderName);
}

export async function createInstanceFolder(gameDir: string, instance: GameInstance): Promise<string> {
  const instancesDir = path.join(gameDir, "instances");
  
  let existingNames: string[] = [];
  if (existsSync(instancesDir)) {
    existingNames = readdirSync(instancesDir);
  }
  
  const folderName = generateUniqueFolderName(instance.name, existingNames);
  const instanceFolder = path.join(instancesDir, folderName);
  
  for (const sub of ["mods", "config", "saves", "resourcepacks", "shaderpacks", "logs"]) {
    await fs.mkdir(path.join(instanceFolder, sub), { recursive: true });
  }
  
  instance.instanceFolder = folderName;
  
  return instanceFolder;
}

export async function ensureInstanceFolder(gameDir: string, instance: GameInstance): Promise<string> {
  if (instance.instanceFolder) {
    const folderPath = path.join(gameDir, "instances", instance.instanceFolder);
    if (existsSync(folderPath)) {
      return folderPath;
    }
  }
  
  const instancesDir = path.join(gameDir, "instances");
  if (existsSync(instancesDir)) {
    const entries = readdirSync(instancesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const instanceIdFile = path.join(instancesDir, entry.name, ".instance_id");
        if (existsSync(instanceIdFile)) {
          const savedId = await fs.readFile(instanceIdFile, "utf-8");
          if (savedId.trim() === instance.id) {
            instance.instanceFolder = entry.name;
            return path.join(instancesDir, entry.name);
          }
        }
        if (entry.name === sanitizeFolderName(instance.name)) {
          instance.instanceFolder = entry.name;
          return path.join(instancesDir, entry.name);
        }
      }
    }
  }
  
  return createInstanceFolder(gameDir, instance);
}

export async function ensureInstanceDirs(gameDir: string, instanceId: string, instanceName?: string) {
  const instancesDir = path.join(gameDir, "instances");
  
  if (existsSync(instancesDir)) {
    const entries = readdirSync(instancesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const instanceIdFile = path.join(instancesDir, entry.name, ".instance_id");
        if (existsSync(instanceIdFile)) {
          const savedId = await fs.readFile(instanceIdFile, "utf-8");
          if (savedId.trim() === instanceId) {
            return path.join(instancesDir, entry.name);
          }
        }
      }
    }
  }
  
  const folderName = instanceName ? sanitizeFolderName(instanceName) : instanceId;
  const finalFolderName = generateUniqueFolderName(folderName, 
    existsSync(instancesDir) ? readdirSync(instancesDir) : []
  );
  const base = path.join(instancesDir, finalFolderName);
  
  for (const sub of ["mods", "config", "saves", "resourcepacks", "shaderpacks", "logs"]) {
    await fs.mkdir(path.join(base, sub), { recursive: true });
  }
  
  await fs.writeFile(path.join(base, ".instance_id"), instanceId);
  
  return base;
}

export function listInstalledVersionIds(gameDir: string): string[] {
  const versionsRoot = path.join(gameDir, "versions");
  if (!existsSync(versionsRoot)) return [];
  const ids: string[] = [];
  for (const name of readdirSync(versionsRoot)) {
    const json = path.join(versionsRoot, name, `${name}.json`);
    if (existsSync(json)) ids.push(name);
  }
  return ids.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

function loaderIcon(loader: InstanceLoader): InstanceIcon {
  switch (loader) {
    case "forge":
      return "forge";
    case "fabric":
      return "fabric";
    case "quilt":
      return "quilt";
    case "neoforge":
      return "neoforge";
    case "optifine":
      return "optifine";
    default:
      return "grass";
  }
}

export function createInstanceRecord(
  partial: Pick<GameInstance, "name" | "versionId"> & Partial<Omit<GameInstance, "name" | "versionId">>
): GameInstance {
  const now = Date.now();
  const loader = partial.loader ?? detectLoader(partial.versionId);
  return {
    id: partial.id ?? randomUUID(),
    name: partial.name.trim() || partial.versionId,
    versionId: partial.versionId,
    mcVersion: partial.mcVersion ?? detectMcVersion(partial.versionId),
    loader: loader,
    icon: partial.icon ?? loaderIcon(loader),
    createdAt: partial.createdAt ?? now,
    lastPlayed: partial.lastPlayed,
    playTimeMs: partial.playTimeMs ?? 0,
    notes: partial.notes ?? "",
    instanceFolder: partial.instanceFolder,
  };
}

export function defaultInstanceName(versionId: string, loader?: InstanceLoader): string {
  const l = loader ?? detectLoader(versionId);
  const mc = detectMcVersion(versionId);
  if (l === "vanilla") return mc;
  const labels: Record<InstanceLoader, string> = {
    vanilla: mc,
    forge: "Forge",
    fabric: "Fabric",
    quilt: "Quilt",
    neoforge: "NeoForge",
    optifine: "OptiFine",
  };
  return `${labels[l]} ${mc}`;
}