import type { LauncherSettings, VersionInfo } from "../types/api";

export type VersionFilter = LauncherSettings["versionFilter"];

export const VERSION_FILTER_OPTIONS: { id: VersionFilter; label: string }[] = [
  { id: "all", label: "Все версии" },
  { id: "release", label: "Релизы" },
  { id: "snapshot", label: "Снапшоты" },
  { id: "old_beta", label: "Beta" },
  { id: "old_alpha", label: "Alpha" },
];

export function versionTypeLabel(type: string): string {
  switch (type) {
    case "release":
      return "Релиз";
    case "snapshot":
      return "Снапшот";
    case "old_beta":
      return "Beta";
    case "old_alpha":
      return "Alpha";
    default:
      return type;
  }
}

export function groupVersionsByType(versions: VersionInfo[]) {
  const order = ["release", "snapshot", "old_beta", "old_alpha"] as const;
  const groups: { type: string; label: string; items: VersionInfo[] }[] = [];

  for (const type of order) {
    const items = versions.filter((v) => v.type === type);
    if (items.length > 0) {
      groups.push({ type, label: versionTypeLabel(type), items });
    }
  }

  const known = new Set(order);
  const other = versions.filter((v) => !known.has(v.type as (typeof order)[number]));
  if (other.length > 0) {
    groups.push({ type: "other", label: "Другое", items: other });
  }

  return groups;
}
