/** URL головы скина (mc-heads стабильнее crafatar в Electron) */
export function skinHeadUrl(username: string, uuid?: string): string {
  const id = uuid?.replace(/-/g, "") || encodeURIComponent(username);
  return `https://mc-heads.net/avatar/${id}/48`;
}

export const SKIN_FALLBACK =
  "https://mc-heads.net/avatar/Steve/48";
