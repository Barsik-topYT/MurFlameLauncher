import type { Account } from "./types.js";

export function skinHeadUrl(username: string, uuid?: string): string {
  const id = uuid?.replace(/-/g, "") || encodeURIComponent(username);
  return `https://mc-heads.net/avatar/${id}/48`;
}

export function accountSkinUrl(account: Pick<Account, "username" | "uuid">): string {
  return skinHeadUrl(account.username, account.uuid);
}

export function resolveAvatarUrl(acc: Account): string {
  if (acc.skinHeadUrl) return acc.skinHeadUrl;
  if (acc.uuid) return `https://mc-heads.net/head/${acc.uuid.replace(/-/g, "")}/96`;
  return skinHeadUrl(acc.username, acc.uuid);
}
