import type { InstanceIcon } from "../vite-env.d";
import { iconEmoji } from "../utils/instanceUtils";

interface Props {
  icon: InstanceIcon;
  size?: number;
  className?: string;
}

export function InstanceIconView({ icon, size = 48, className = "" }: Props) {
  const emoji = iconEmoji(icon);
  return (
    <div
      className={`instance-icon ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      aria-hidden
    >
      {emoji}
    </div>
  );
}
