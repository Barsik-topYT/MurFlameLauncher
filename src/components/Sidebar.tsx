import { Home, Users, Package, Settings, Shirt, Flame } from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import { SkinAvatar } from "./SkinAvatar";

const NAV = [
  { id: "home" as const, icon: Home, label: "Экземпляры" },
  { id: "accounts" as const, icon: Users, label: "Аккаунты" },
  { id: "skins" as const, icon: Shirt, label: "Скины" },
  { id: "versions" as const, icon: Package, label: "Версии" },
  { id: "settings" as const, icon: Settings, label: "Настройки" },
];

export function Sidebar() {
  const page = useLauncherStore((s) => s.page);
  const setPage = useLauncherStore((s) => s.setPage);
  const activeAccount = useLauncherStore((s) => s.activeAccount);
  const settings = useLauncherStore((s) => s.settings);
  const compact = settings?.sidebarCompact;

  return (
    <aside className={`sidebar ${compact ? "compact" : ""}`}>
      <div className="sidebar-brand">
        <Flame size={22} className="flame sidebar-brand-icon" />
        {!compact && <span>MurFlame</span>}
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            className={`nav-item ${page === id ? "active" : ""}`}
            onClick={() => setPage(id)}
            title={label}
          >
            <Icon size={20} />
            {!compact && <span>{label}</span>}
          </button>
        ))}
      </nav>

      {activeAccount && (
        <div className={`sidebar-account ${compact ? "compact" : ""}`}>
          <SkinAvatar account={activeAccount} size={compact ? 36 : 44} className="account-avatar" />
          {!compact && (
            <div className="sidebar-account-text">
              <div className="name">{activeAccount.username}</div>
              <div className="type">
                {activeAccount.type === "microsoft" ? "Лицензия" : "Офлайн"}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
