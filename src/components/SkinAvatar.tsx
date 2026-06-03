import { useEffect, useState } from "react";
import { skinHeadUrl, SKIN_FALLBACK } from "../utils/skin";
import type { Account } from "../types/api";

interface SkinAvatarProps {
  account: Pick<Account, "id" | "username" | "uuid" | "skinUrl" | "skinHeadUrl">;
  size?: number;
  className?: string;
}

export function SkinAvatar({ account, size = 48, className = "" }: SkinAvatarProps) {
  const initial =
    account.skinHeadUrl ||
    account.skinUrl ||
    skinHeadUrl(account.username, account.uuid);

  const [src, setSrc] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const fallback =
      account.skinHeadUrl ||
      account.skinUrl ||
      skinHeadUrl(account.username, account.uuid);
    setSrc(fallback);

    if (window.murflame?.skin?.getAvatar) {
      window.murflame.skin
        .getAvatar(account.id)
        .then((url) => {
          if (!cancelled && url) setSrc(url);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [account.id, account.username, account.uuid, account.skinUrl, account.skinHeadUrl]);

  return (
    <img
      className={className}
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
      onError={() => setSrc(SKIN_FALLBACK)}
    />
  );
}
