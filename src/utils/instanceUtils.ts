import type { GameInstance, InstanceIcon, InstanceLoader } from "../vite-env.d";

export const LOADER_LABELS: Record<InstanceLoader, string> = {
  vanilla: "Vanilla",
  forge: "Forge",
  fabric: "Fabric",
  quilt: "Quilt",
  neoforge: "NeoForge",
  optifine: "OptiFine",
};

export const ICON_OPTIONS: { id: InstanceIcon; label: string; emoji: string }[] = [
  { id: "grass", label: "Трава", emoji: "🟩" },
  { id: "forge", label: "Forge", emoji: "🔧" },
  { id: "fabric", label: "Fabric", emoji: "🧵" },
  { id: "quilt", label: "Quilt", emoji: "🪡" },
  { id: "neoforge", label: "NeoForge", emoji: "⚙️" },
  { id: "optifine", label: "OptiFine", emoji: "✨" },
  { id: "diamond", label: "Алмаз", emoji: "💎" },
  { id: "tnt", label: "TNT", emoji: "💥" },
  { id: "star", label: "Звезда", emoji: "⭐" },
];

export function formatPlayTime(ms: number): string {
  if (ms <= 0) return "—";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} мин`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return `${hours}ч ${rem}мин`;
  const days = Math.floor(hours / 24);
  return `${days}д ${hours % 24}ч`;
}

export function formatLastPlayed(ts?: number): string {
  if (!ts) return "Ещё не играли";
  const d = new Date(ts);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function instanceSubtitle(inst: GameInstance): string {
  const loader = LOADER_LABELS[inst.loader] || "Vanilla";
  if (inst.loader === "vanilla" || !inst.loader) return inst.mcVersion;
  return `${loader} · ${inst.mcVersion}`;
}

export function iconEmoji(icon: InstanceIcon): string {
  return ICON_OPTIONS.find((o) => o.id === icon)?.emoji ?? "🟩";
}
