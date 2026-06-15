import {
  Home,
  Users,
  Package,
  Settings,
  Palette,
  Gamepad2,
  Upload,
  Flame
} from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import { useLocale } from "../hooks/useLocale";

const menuItems = [
  { id: "home", labelKey: "nav.home", icon: Home },
  { id: "accounts", labelKey: "nav.accounts", icon: Users },
  { id: "versions", labelKey: "nav.versions", icon: Package },
  { id: "mods", labelKey: "nav.mods", icon: Gamepad2 },
  { id: "skins", labelKey: "nav.skins", icon: Palette },
  { id: "modpack-import", labelKey: "nav.import", icon: Upload },
  { id: "settings", labelKey: "nav.settings", icon: Settings },
];

export function Sidebar() {
  const { page, setPage, settings } = useLauncherStore();
  const { t } = useLocale();
  const isCompact = settings?.sidebarCompact ?? false;
  const uiMode = settings?.uiMode ?? "default";

  // В упрощённом режиме скрываем сайдбар
  if (uiMode === "simplified") {
    return null;
  }

  return (
    <aside className={`sidebar ${isCompact ? "compact" : ""}`}>
      <div className="sidebar-brand">
        <Flame size={28} className="sidebar-brand-icon" />
        {!isCompact && <span>MurFlame</span>}
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = page === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={() => setPage(item.id as any)}
              title={isCompact ? t(item.labelKey) : undefined}
            >
              <Icon size={20} />
              {!isCompact && <span>{t(item.labelKey)}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}