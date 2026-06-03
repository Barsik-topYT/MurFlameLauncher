import { useEffect, useState } from "react";
import { Upload, RotateCcw, RefreshCw, Download, Check } from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import { SkinAvatar } from "../components/SkinAvatar";

// Список доступных плащей (официальные плащи Minecraft)
const OFFICIAL_CAPES = [
  { id: "minecon-2011", name: "MineCon 2011", icon: "🎪" },
  { id: "minecon-2012", name: "MineCon 2012", icon: "🎪" },
  { id: "minecon-2013", name: "MineCon 2013", icon: "🎪" },
  { id: "minecon-2015", name: "MineCon 2015", icon: "🎪" },
  { id: "minecon-2016", name: "MineCon 2016", icon: "🎪" },
  { id: "cobalt", name: "Cobalt", icon: "💙" },
  { id: "scrolls", name: "Scrolls", icon: "📜" },
  { id: "translator", name: "Translator", icon: "🌐" },
  { id: "mojang", name: "Mojang", icon: "🍎" },
  { id: "dannybstyle", name: "DannyBstyle", icon: "🎨" },
  { id: "cheese", name: "Cheese", icon: "🧀" },
  { id: "turtle", name: "Turtle", icon: "🐢" },
  { id: "migrator", name: "Migrator", icon: "🔄" },
];

export function SkinsPage() {
  const { activeAccount, loadAccounts, setError, error } = useLauncherStore();
  const [variant, setVariant] = useState<"classic" | "slim">("classic");
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewHead, setPreviewHead] = useState<string | null>(null);
  const [capePreview, setCapePreview] = useState<string | null>(null);
  const [previewCapeFile, setPreviewCapeFile] = useState<string | null>(null);
  const [selectedCape, setSelectedCape] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"skin" | "cape">("skin");
  const [ownedCapes, setOwnedCapes] = useState<string[]>([]);

  const isPremium = activeAccount?.type === "microsoft";

  useEffect(() => {
    if (activeAccount?.skinVariant) {
      setVariant(activeAccount.skinVariant);
    }
  }, [activeAccount?.id, activeAccount?.skinVariant]);

  useEffect(() => {
    if (!activeAccount || !isPremium || !window.murflame) return;
    
    // Синхронизация скина и плаща
    const syncData = async () => {
      try {
        await window.murflame?.skin.sync(activeAccount.id);
        await loadAccounts();
        
        // Загрузка информации о плаще
        if (activeAccount.uuid) {
          const uuid = activeAccount.uuid.replace(/-/g, "");
          setCapePreview(`https://crafatar.com/capes/${uuid}`);
          
          // Получение списка плащей аккаунта
          const capes = await window.murflame?.skin.getCapes?.(activeAccount.id);
          setOwnedCapes(capes || []);
        }
      } catch (e) {
        console.error("Sync failed:", e);
      }
    };
    
    syncData();
  }, [activeAccount?.id]);

  if (!activeAccount) {
    return (
      <div className="page-header">
        <h2>Скины и плащи</h2>
        <p>Выберите аккаунт во вкладке «Аккаунты»</p>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <>
        <div className="page-header">
          <h2>Скины и плащи</h2>
          <p>Требуется лицензионный аккаунт Microsoft для управления скинами и плащами</p>
        </div>
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <p>Войдите в лицензионный аккаунт Microsoft, чтобы менять скин и плащ.</p>
        </div>
      </>
    );
  }

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

  const handlePickCape = async () => {
    if (!window.murflame) return;
    const file = await window.murflame.skin.pickFile();
    if (!file) return;
    setPreviewCapeFile(file);
    setSuccess(null);
  };

  const handleApplySkin = async () => {
    if (!window.murflame || !previewFile) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await window.murflame.skin.apply(activeAccount.id, previewFile, variant);
      await loadAccounts();
      setPreviewFile(null);
      setPreviewHead(null);
      setSuccess("Скин загружен на аккаунт Mojang! Обновится через несколько секунд.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCape = async () => {
    if (!window.murflame || !previewCapeFile) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await window.murflame.skin.applyCape?.(activeAccount.id, previewCapeFile);
      await loadAccounts();
      setPreviewCapeFile(null);
      setSuccess("Плащ загружен на аккаунт Mojang!");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOfficialCape = async (capeId: string) => {
    if (!window.murflame) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await window.murflame.skin.setOfficialCape?.(activeAccount.id, capeId);
      await loadAccounts();
      setSelectedCape(capeId);
      setSuccess(`Плащ "${capeId}" установлен!`);
      
      // Обновляем превью
      if (activeAccount.uuid) {
        const uuid = activeAccount.uuid.replace(/-/g, "");
        setCapePreview(`https://crafatar.com/capes/${uuid}?t=${Date.now()}`);
      }
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
      await window.murflame.skin.reset(activeAccount.id);
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

  const handleResetCape = async () => {
    if (!window.murflame) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await window.murflame.skin.resetCape?.(activeAccount.id);
      await loadAccounts();
      setPreviewCapeFile(null);
      setSelectedCape(null);
      setCapePreview(null);
      setSuccess("Плащ сброшен.");
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
      await window.murflame.skin.sync(activeAccount.id);
      await loadAccounts();
      
      // Обновляем превью плаща
      if (activeAccount.uuid) {
        const uuid = activeAccount.uuid.replace(/-/g, "");
        setCapePreview(`https://crafatar.com/capes/${uuid}?t=${Date.now()}`);
      }
      
      setSuccess("Синхронизация с Mojang завершена.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h2>Скины и плащи</h2>
        <p>
          Аккаунт: <strong>{activeAccount.username}</strong>
          <span className="badge-ms" style={{ marginLeft: 8 }}>Microsoft</span>
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
                  Загрузить на Mojang
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
                Файл: {previewFile}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Вкладка плаща */}
      {activeTab === "cape" && (
        <div className="skin-manager" style={{ flexDirection: "column" }}>
          {/* Превью текущего плаща */}
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Текущий плащ</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              {capePreview ? (
                <img
                  src={capePreview}
                  alt="Cape preview"
                  className="cape-preview"
                  style={{ maxWidth: 200, imageRendering: "pixelated" }}
                />
              ) : (
                <div className="cape-placeholder">
                  Нет плаща
                </div>
              )}
              <div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleSync}
                  disabled={loading}
                >
                  <RefreshCw size={14} />
                  Обновить
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleResetCape}
                  disabled={loading}
                  style={{ marginLeft: 8, color: "var(--danger)" }}
                >
                  <RotateCcw size={14} />
                  Сбросить
                </button>
              </div>
            </div>
          </div>

          {/* Загрузка своего плаща */}
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Загрузить свой плащ</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary" onClick={handlePickCape}>
                <Upload size={16} />
                Выбрать PNG плащ (22×17)
              </button>
              {previewCapeFile && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleApplyCape}
                  disabled={loading}
                >
                  Загрузить на Mojang
                </button>
              )}
            </div>
            {previewCapeFile && (
              <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
                Файл: {previewCapeFile}
              </p>
            )}
          </div>

          {/* Список официальных плащей */}
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Официальные плащи Minecraft</h3>
            <div className="capes-grid">
              {OFFICIAL_CAPES.map((cape) => (
                <button
                  key={cape.id}
                  className={`cape-item ${ownedCapes.includes(cape.id) ? "owned" : ""}`}
                  onClick={() => handleSelectOfficialCape(cape.id)}
                  disabled={loading || !ownedCapes.includes(cape.id)}
                >
                  <span className="cape-icon">{cape.icon}</span>
                  <span className="cape-name">{cape.name}</span>
                  {ownedCapes.includes(cape.id) && (
                    <span className="cape-owned-badge">✓</span>
                  )}
                </button>
              ))}
            </div>
            <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
              * Некоторые плащи доступны только при наличии соответствующего достижения.
            </p>
          </div>
        </div>
      )}
    </>
  );
}