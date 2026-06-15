import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import { SkinAvatar } from "../components/SkinAvatar";
import { useLocale } from "../hooks/useLocale";

export function AccountsPage() {
  const { accounts, activeAccount, loadAccounts, setError, error } = useLauncherStore();
  const { t } = useLocale();
  const [offlineName, setOfflineName] = useState("");
  const [modal, setModal] = useState<"offline" | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOffline = async () => {
    if (!offlineName.trim() || !window.murflame) return;
    setLoading(true);
    setError(null);
    try {
      await window.murflame.accounts.offline(offlineName.trim());
      await loadAccounts();
      setModal(null);
      setOfflineName("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoft = async () => {
    if (!window.murflame) return;
    setLoading(true);
    setError(null);
    try {
      await window.murflame.accounts.microsoftLogin();
      await loadAccounts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleElyLogin = async () => {
    if (!window.murflame) return;
    setLoading(true);
    setError(null);
    try {
      await window.murflame.accounts.elyLogin();
      await loadAccounts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h2>{t("accounts.title")}</h2>
        <p>{t("accounts.desc")}</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={() => setModal("offline")}>
          <Plus size={18} />
          {t("accounts.offline")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleMicrosoft} disabled={loading}>
          <Plus size={18} />
          {loading ? "..." : t("accounts.microsoft")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleElyLogin} disabled={loading}>
          <Plus size={18} />
          {loading ? "..." : t("accounts.ely")}
        </button>
      </div>

      <div className="accounts-list">
        {accounts.length === 0 && (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>
            {t("accounts.noAccounts")}
          </p>
        )}
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className={`account-card ${activeAccount?.id === acc.id ? "active" : ""}`}
            onClick={() => window.murflame?.accounts.setActive(acc.id).then(loadAccounts)}
            onKeyDown={(e) =>
              e.key === "Enter" && window.murflame?.accounts.setActive(acc.id).then(loadAccounts)
            }
            role="button"
            tabIndex={0}
          >
            <SkinAvatar account={acc} size={48} className="account-avatar" />
            <div className="account-info">
              <div className="username">{acc.username}</div>
              <span className={`badge ${acc.type === "microsoft" ? "badge-ms" : "badge-offline"}`}>
                {acc.type === "microsoft" ? "Microsoft" : acc.type === "ely" ? "ely.by" : "Офлайн"}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                window.murflame?.accounts.remove(acc.id).then(loadAccounts);
              }}
              aria-label="Удалить"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      {modal === "offline" && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t("accounts.offline")}</h3>
            <p>Введите никнейм для локальной игры без лицензии.</p>
            <input
              className="input"
              placeholder="Никнейм"
              value={offlineName}
              onChange={(e) => setOfflineName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleOffline()}
              maxLength={16}
            />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
                {t("settings.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOffline}
                disabled={loading}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}