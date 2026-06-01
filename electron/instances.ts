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

export function instanceDir(gameDir: string, instanceId: string): string {
  return path.join(gameDir, "instances", instanceId);
}

export async function ensureInstanceDirs(gameDir: string, instanceId: string, instanceName?: string) {
  const folderName = instanceName ? sanitizeFolderName(instanceName) : instanceId;
  const instancesDir = path.join(gameDir, "instances");

  let existingNames: string[] = [];
  if (existsSync(instancesDir)) {
    existingNames = readdirSync(instancesDir);
  }

  const finalFolderName = instanceName ? generateUniqueFolderName(instanceName, existingNames) : instanceId;
  const base = path.join(instancesDir, finalFolderName);

  for (const sub of ["mods", "config", "saves", "resourcepacks", "shaderpacks"]) {
    await fs.mkdir(path.join(base, sub), { recursive: true });
  }
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