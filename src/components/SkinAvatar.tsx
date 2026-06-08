import { useEffect, useState } from "react";
import { skinHeadUrl, SKIN_FALLBACK } from "../utils/skin";
import type { Account } from "../types/api";

interface SkinAvatarProps {
  account: Pick<Account, "id" | "username" | "uuid" | "skinUrl" | "skinHeadUrl" | "capeUrl">;
  size?: number;
  className?: string;
  showCapePreview?: boolean;
}

export function SkinAvatar({ account, size = 48, className = "", showCapePreview = false }: SkinAvatarProps) {
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

  const handleCapePreview = () => {
    if (showCapePreview && account.capeUrl && window.murflame?.skin?.previewCape) {
      window.murflame.skin.previewCape(account.capeUrl);
    }
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <img
        className={className}
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, imageRendering: "pixelated", cursor: showCapePreview ? "pointer" : "default" }}
        onError={() => setSrc(SKIN_FALLBACK)}
        onClick={handleCapePreview}
      />
    </div>
  );
}