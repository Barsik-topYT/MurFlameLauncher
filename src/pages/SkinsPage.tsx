import { useEffect, useState } from "react";
import { RotateCcw, RefreshCw, Check, ExternalLink, Upload } from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import { SkinAvatar } from "../components/SkinAvatar";

// Компонент управления плащом
function CapeManager({ account, onUpdate }: { account: any; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);
  const [capes, setCapes] = useState<any[]>([]);
  const [currentCapeId, setCurrentCapeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadCapes();
  }, [account.id]);

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
      setSuccess("Плащ сброшен!");
      onUpdate();
      await loadCapes();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCape = async (capeId: string) => {
    if (!window.murflame) return;
    setLoading(true);
    setError(null);
    try {
      await window.murflame.skin.setOfficialCape?.(account.id, capeId);
      setSuccess("Плащ установлен!");
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
        <h3>Текущий плащ</h3>
        <div className="current-cape">
          {account.capeUrl ? (
            <img src={account.capeUrl} alt="Current cape" className="cape-preview" />
          ) : (
            <div className="cape-placeholder">Нет плаща</div>
          )}
          <div className="cape-actions">
            <button className="btn btn-ghost" onClick={loadCapes} disabled={loading}>
              <RefreshCw size={16} />
              Обновить
            </button>
            <button className="btn btn-ghost" onClick={handleResetCape} disabled={loading}>
              <RotateCcw size={16} />
              Сбросить
            </button>
          </div>
        </div>
      </div>

      {/* Список плащей аккаунта */}
      {capes.length > 0 && (
        <div className="card">
          <h3>Мои плащи</h3>
          <div className="capes-grid">
            {capes.map((cape) => (
              <button
                key={cape.id}
                className={`cape-card ${cape.current ? "current" : ""}`}
                onClick={() => handleSelectCape(cape.id)}
                disabled={loading || cape.current}
              >
                <img src={cape.url} alt={cape.name} className="cape-thumbnail" />
                <div className="cape-info">
                  <div className="cape-name">{cape.name}</div>
                  {cape.current && <span className="current-badge">Текущий</span>}
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
      setSuccess("Успешный вход в ely.by!");
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
      setSuccess("Скин загружен! Обновится через несколько секунд.");
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
      setSuccess("Скин сброшен до стандартного.");
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
      setSuccess("Синхронизация завершена.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!activeAccount) {
    return (
      <div className="page-header">
        <h2>Скины и плащи</h2>
        <p>Выберите аккаунт во вкладке «Аккаунты»</p>
      </div>
    );
  }

  // Показываем ely.by вход для пиратских аккаунтов
  if (activeAccount.type === "offline") {
    return (
      <>
        <div className="page-header">
          <h2>Скины и плащи</h2>
          <p>Войдите в ely.by для управления скинами и плащами</p>
        </div>
        
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ marginBottom: 20 }}>
            ely.by — бесплатный сервис скинов для Minecraft
          </p>
          <button
            className="btn btn-primary"
            onClick={handleElyLogin}
            disabled={loading}
          >
            <ExternalLink size={16} />
            Войти через ely.by
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>Скины и плащи</h2>
        <p>
          Аккаунт: <strong>{activeAccount.username}</strong>
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
          🎨 Скин
        </button>
        <button
          className={`tab ${activeTab === "cape" ? "active" : ""}`}
          onClick={() => setActiveTab("cape")}
        >
          🧥 Плащ
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
              <SkinAvatar account={activeAccount} size={96} className="account-avatar" />
            )}
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 12 }}>
              {previewHead ? "Предпросмотр (голова)" : "Текущий скин"}
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 8, fontSize: 12 }}
              onClick={handleSync}
              disabled={loading}
            >
              <RefreshCw size={14} />
              Синхронизировать
            </button>
          </div>

          <div className="card" style={{ flex: 1 }}>
            <div className="form-group">
              <label>Модель рук</label>
              <select
                className="select"
                value={variant}
                onChange={(e) => setVariant(e.target.value as "classic" | "slim")}
              >
                <option value="classic">Classic (широкие рукава, как у Steve)</option>
                <option value="slim">Slim (тонкие рукава, как у Alex)</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary" onClick={handlePickSkin}>
                <Upload size={16} />
                Выбрать PNG скин
              </button>
              {previewFile && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleApplySkin}
                  disabled={loading}
                >
                  Загрузить
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleResetSkin}
                disabled={loading}
              >
                <RotateCcw size={16} />
                Сбросить скин
              </button>
            </div>

            {previewFile && (
              <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
                Файл: {previewFile.split(/[/\\]/).pop()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Вкладка плаща */}
      {activeTab === "cape" && (
        <CapeManager account={activeAccount} onUpdate={loadAccounts} />
      )}

      <style>{`
        .skin-manager {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }
        
        .skin-preview-card {
          text-align: center;
          min-width: 150px;
        }
        
        .badge-ms {
          background: #107c10;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
        }
        
        .badge-ely {
          background: #9b59b6;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
        }
        
        .tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--border-color);
        }
        
        .tab {
          padding: 8px 16px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          color: var(--text-muted);
          transition: all 0.2s;
        }
        
        .tab.active {
          color: var(--accent);
          border-bottom: 2px solid var(--accent);
        }
        
        .account-avatar {
          width: 96px;
          height: 96px;
          border-radius: 8px;
          background: var(--bg-secondary);
          image-rendering: pixelated;
        }
        
        .alert {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        
        .alert-error {
          background: rgba(220, 38, 38, 0.1);
          border: 1px solid rgba(220, 38, 38, 0.3);
          color: #ef4444;
        }
        
        .alert-success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }
        
        .text-muted {
          color: var(--text-muted);
          font-size: 12px;
        }
        
        .cape-manager {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .current-cape {
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }
        
        .cape-preview {
          width: 200px;
          height: auto;
          image-rendering: pixelated;
          background: var(--bg-secondary);
          border-radius: 8px;
        }
        
        .cape-placeholder {
          width: 200px;
          height: 80px;
          background: var(--bg-secondary);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }
        
        .cape-thumbnail {
          width: 48px;
          height: 32px;
          image-rendering: pixelated;
        }
        
        .cape-actions {
          display: flex;
          gap: 8px;
        }
        

        
        .capes-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }
        
        .cape-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          width: 100%;
        }
        
        .cape-card:hover:not(:disabled) {
          background: var(--bg-hover);
          transform: translateX(4px);
        }
        
        .cape-card.current {
          border-left: 3px solid #f59e0b;
          background: rgba(245, 158, 11, 0.1);
          cursor: default;
        }
        
        .cape-card.current:hover {
          transform: none;
        }
        
        .cape-info {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .cape-name {
          font-weight: 600;
        }
        
        .current-badge {
          font-size: 11px;
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.2);
          padding: 2px 8px;
          border-radius: 4px;
        }
        
        .check-icon {
          color: #10b981;
        }
      `}</style>
    </>
  );
}