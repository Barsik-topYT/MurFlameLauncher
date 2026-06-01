import { MojangClient } from "@xmcl/user";
import type { Account } from "./types.js";
import { accountSkinUrl } from "./skinUtils.js";

export function mojangHeadUrl(uuid: string, bust = false): string {
  const id = uuid.replace(/-/g, "");
  const path = bust ? "bust" : "head";
  return `https://mc-heads.net/${path}/${id}/96`;
}

export async function fetchMojangProfile(accessToken: string) {
  const mojang = new MojangClient({});
  return mojang.getProfile(accessToken);
}

/** Обновить ник, скин и URL головы с серверов Mojang */
export async function applyProfileToAccount(acc: Account, accessToken: string): Promise<Account> {
  const profile = await fetchMojangProfile(accessToken);
  const active = profile.skins?.find((s) => s.state === "ACTIVE") ?? profile.skins?.[0];

  const variant = active?.variant === "SLIM" ? "slim" : "classic";

  const ts = Date.now();
  const uuid = profile.id;

  return {
    ...acc,
    id: uuid,
    uuid,
    username: profile.name,
    accessToken,
    skinVariant: variant,
    skinTextureUrl: active?.url,
    skinUrl: `${accountSkinUrl({ username: profile.name, uuid })}?t=${ts}`,
    skinHeadUrl: `${mojangHeadUrl(uuid)}?t=${ts}`,
  };
}