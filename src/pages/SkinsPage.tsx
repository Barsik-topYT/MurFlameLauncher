import { useEffect, useState } from "react";
import { RotateCcw, RefreshCw, Check, ExternalLink, Upload } from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import { SkinAvatar } from "../components/SkinAvatar";
import { useLocale } from "../hooks/useLocale";

// Компонент управления плащом
function CapeManager({ account, onUpdate }: { account: any; onUpdate: () => void }) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [capes, setCapes] = useState<any[]>([]);
  const [currentCapeId, setCurrentCapeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedCapeUrl, setSelectedCapeUrl] = useState<string | null>(account.capeUrl || null);

  useEffect(() => {
    loadCapes();
  }, [account.id]);

  useEffect(() => {
    setSelectedCapeUrl(account.capeUrl || null);
  }, [account.capeUrl]);

  const loadCapes = async () => {
    if (!window.murflame) return;
    setLoading(true);
    try {
      const capesList = await window.murflame.skin.getCapes?.(account.id);
      setCapes(capesList || []);
      const current = capesList?.find((c: any) => c.current);
      setCurrentCapeId(current?.id || null);
    } catch (e) {
      console.error("Failed to load capes:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleResetCape = async () => {
    if (!window.murflame) return;
    setLoading(true);
    setError(null);
    try {
      await window.murflame.skin.resetCape?.(account.id);
      setSuccess(t("skins.capeReset") || "Плащ сброшен!");
      setSelectedCapeUrl(null);
      onUpdate();
      await loadCapes();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCape = async (capeId: string, capeUrl: string) => {
    if (!window.murflame) return;
    setLoading(true);
    setError(null);
    try {
      await window.murflame.skin.setOfficialCape?.(account.id, capeId);
      setSuccess(t("skins.capeSet") || "Плащ установлен!");
      setSelectedCapeUrl(capeUrl);
      onUpdate();
      await loadCapes();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cape-manager">
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      
      {/* Текущий плащ */}
      <div className="card">
        <h3>{t("skins.currentCape")}</h3>
        <div className="current-cape">
          {account.capeUrl ? (
            <img 
              src={account.capeUrl} 
              alt="Current cape" 
              className="cape-preview"
            />
          ) : (
            <div className="cape-placeholder">{t("skins.noCape")}</div>
          )}
          <div className="cape-actions">
            <button className="btn btn-ghost" onClick={loadCapes} disabled={loading}>
              <RefreshCw size={16} />
              {t("skins.refresh")}
            </button>
            <button className="btn btn-ghost" onClick={handleResetCape} disabled={loading}>
              <RotateCcw size={16} />
              {t("skins.resetCape")}
            </button>
          </div>
        </div>
      </div>

      {/* Список плащей аккаунта */}
      {capes.length > 0 && (
        <div className="card">
          <h3>{t("skins.myCapes")}</h3>
          <div className="capes-grid">
            {capes.map((cape) => (
              <button
                key={cape.id}
                className={`cape-card ${cape.current ? "current" : ""}`}
                onClick={() => handleSelectCape(cape.id, cape.url)}
                disabled={loading || cape.current}
                title={t("skins.clickToEquip")}
              >
                <img src={cape.url} alt={cape.name} className="cape-thumbnail" />
                <div className="cape-info">
                  <div className="cape-name">{cape.name}</div>
                  {cape.current && <span className="current-badge">{t("skins.current")}</span>}
                </div>
                {!cape.current && <Check size={16} className="check-icon" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SkinsPage() {
  const { t } = useLocale();
  const { activeAccount, loadAccounts, setError, error } = useLauncherStore();
  const [variant, setVariant] = useState<"classic" | "slim">("classic");
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewHead, setPreviewHead] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"skin" | "cape">("skin");

  const isPremium = activeAccount?.type === "microsoft";
  const isEly = activeAccount?.type === "ely";

  useEffect(() => {
    if (activeAccount?.skinVariant) {
      setVariant(activeAccount.skinVariant);
    }
  }, [activeAccount?.id, activeAccount?.skinVariant]);

  useEffect(() => {
    if (!activeAccount || (!isPremium && !isEly) || !window.murflame) return;
    
    const syncData = async () => {
      try {
        await window.murflame?.skin.sync(activeAccount.id);
        await loadAccounts();
      } catch (e) {
        console.error("Sync failed:", e);
      }
    };
    
    syncData();
  }, [activeAccount?.id]);

  const handleElyLogin = async () => {
    if (!window.murflame) return;
    setLoading(true);
    setError(null);
    try {
      await window.murflame.accounts.elyLogin();
      await loadAccounts();
      setSuccess(t("skins.elyLoginSuccess"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePickSkin = async () => {
    if (!window.murflame) return;
    const file = await window.murflame.skin.pickFile();
    if (!file) return;
    setPreviewFile(file);
    setSuccess(null);
    try {
      const head = await window.murflame.skin.previewHead(file);
      setPreviewHead(head);
    } catch (e) {
      setError((e as Error).message);
      setPreviewHead(null);
    }
  };

  const handleApplySkin = async () => {
    if (!window.murflame || !previewFile) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await window.murflame.skin.apply(activeAccount!.id, previewFile, variant);
      await loadAccounts();
      setPreviewFile(null);
      setPreviewHead(null);
      setSuccess(t("skins.skinUploaded"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSkin = async () => {
    if (!window.murflame) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await window.murflame.skin.reset(activeAccount!.id);
      await loadAccounts();
      setPreviewFile(null);
      setPreviewHead(null);
      setSuccess(t("skins.skinReset"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!window.murflame) return;
    setLoading(true);
    setError(null);
    try {
      await window.murflame.skin.sync(activeAccount!.id);
      await loadAccounts();
      setSuccess(t("skins.syncComplete"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!activeAccount) {
    return (
      <div className="page-header">
        <h2>{t("skins.title")}</h2>
        <p>{t("skins.selectAccount")}</p>
      </div>
    );
  }

  // Показываем ely.by вход для пиратских аккаунтов
  if (activeAccount.type === "offline") {
    return (
      <>
        <div className="page-header">
          <h2>{t("skins.title")}</h2>
          <p>{t("skins.elyDesc")}</p>
        </div>
        
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ marginBottom: 20 }}>
            ely.by — {t("skins.elyFree")}
          </p>
          <button
            className="btn btn-primary"
            onClick={handleElyLogin}
            disabled={loading}
          >
            <ExternalLink size={16} />
            {t("skins.elyLogin")}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>{t("skins.title")}</h2>
        <p>
          {t("skins.account")} <strong>{activeAccount.username}</strong>
          <span className={`badge ${isPremium ? "badge-ms" : "badge-ely"}`} style={{ marginLeft: 8 }}>
            {isPremium ? "Microsoft" : "ely.by"}
          </span>
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="tabs">
        <button
          className={`tab ${activeTab === "skin" ? "active" : ""}`}
          onClick={() => setActiveTab("skin")}
        >
          {t("skins.skin")}
        </button>
        <button
          className={`tab ${activeTab === "cape" ? "active" : ""}`}
          onClick={() => setActiveTab("cape")}
        >
          {t("skins.cape")}
        </button>
      </div>

      {/* Вкладка скина */}
      {activeTab === "skin" && (
        <div className="skin-manager">
          <div className="card skin-preview-card">
            {previewHead ? (
              <img
                src={previewHead}
                alt=""
                className="account-avatar"
                width={96}
                height={96}
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <SkinAvatar account={activeAccount} size={96} className="account-avatar" showCapePreview={true} />
            )}
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 12 }}>
              {previewHead ? t("skins.skinPreview") : t("skins.currentSkin")}
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 8, fontSize: 12 }}
              onClick={handleSync}
              disabled={loading}
            >
              <RefreshCw size={14} />
              {t("skins.sync")}
            </button>
          </div>

          <div className="card" style={{ flex: 1 }}>
            <div className="form-group">
              <label>{t("skins.model")}</label>
              <select
                className="select"
                value={variant}
                onChange={(e) => setVariant(e.target.value as "classic" | "slim")}
              >
                <option value="classic">{t("skins.modelClassic")}</option>
                <option value="slim">{t("skins.modelSlim")}</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary" onClick={handlePickSkin}>
                <Upload size={16} />
                {t("skins.selectSkin")}
              </button>
              {previewFile && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleApplySkin}
                  disabled={loading}
                >
                  {t("skins.upload")}
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleResetSkin}
                disabled={loading}
              >
                <RotateCcw size={16} />
                {t("skins.reset")}
              </button>
            </div>

            {previewFile && (
              <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
                {t("skins.file")}: {previewFile.split(/[/\\]/).pop()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Вкладка плаща */}
      {activeTab === "cape" && (
        <CapeManager account={activeAccount} onUpdate={loadAccounts} />
      )}
    </>
  );
}