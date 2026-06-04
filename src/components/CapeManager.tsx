import { useState, useEffect } from "react";
import { Upload, RotateCcw, RefreshCw, Check, Crown, Lock } from "lucide-react";
import type { Account } from "../types";

interface CapeManagerProps {
  account: Account;
  onUpdate: () => void;
}

// Официальные плащи Minecraft
const OFFICIAL_CAPES = [
  { id: "minecon-2011", name: "MineCon 2011", rarity: "legendary", description: "Участники MineCon 2011" },
  { id: "minecon-2012", name: "MineCon 2012", rarity: "legendary", description: "Участники MineCon 2012" },
  { id: "minecon-2013", name: "MineCon 2013", rarity: "legendary", description: "Участники MineCon 2013" },
  { id: "minecon-2015", name: "MineCon 2015", rarity: "legendary", description: "Участники MineCon 2015" },
  { id: "minecon-2016", name: "MineCon 2016", rarity: "legendary", description: "Участники MineCon 2016" },
  { id: "cobalt", name: "Cobalt", rarity: "rare", description: "Создатели Cobalt" },
  { id: "scrolls", name: "Scrolls", rarity: "rare", description: "Создатели Scrolls" },
  { id: "translator", name: "Translator", rarity: "epic", description: "Переводчики Crowdin" },
  { id: "mojang", name: "Mojang", rarity: "epic", description: "Сотрудники Mojang" },
  { id: "dannybstyle", name: "DannyBstyle", rarity: "epic", description: "DannyBstyle" },
  { id: "cheese", name: "Cheese", rarity: "rare", description: "Победители конкурса" },
  { id: "turtle", name: "Turtle", rarity: "rare", description: "Turtle" },
  { id: "migrator", name: "Migrator", rarity: "common", description: "Перешедшие на Microsoft" },
  { id: "vanilla", name: "Vanilla", rarity: "common", description: "Стандартный" },
];

export function CapeManager({ account, onUpdate }: CapeManagerProps) {
  const [loading, setLoading] = useState(false);
  const [ownedCapes, setOwnedCapes] = useState<string[]>([]);
  const [currentCape, setCurrentCape] = useState<string | null>(null);
  const [previewCapeFile, setPreviewCapeFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isEly = account.type === "ely";
  const isMicrosoft = account.type === "microsoft";

  useEffect(() => {
    loadCapes();
  }, [account.id]);

  const loadCapes = async () => {
    if (!window.murflame) return;
    try {
      const capes = await window.murflame.skin.getCapes?.(account.id);
      setOwnedCapes(capes || []);
      if (account.capeUrl) {
        setCurrentCape(account.capeUrl);
      }
    } catch (e) {
      console.error("Failed to load capes:", e);
    }
  };

  const handlePickCape = async () => {
    if (!window.murflame) return;
    const file = await window.murflame.skin.pickFile();
    if (!file) return;
    setPreviewCapeFile(file);
    setError(null);
    setSuccess(null);
  };

  const handleApplyCape = async () => {
    if (!window.murflame || !previewCapeFile) return;
    setLoading(true);
    setError(null);
    try {
      await window.murflame.skin.applyCape?.(account.id, previewCapeFile);
      setPreviewCapeFile(null);
      setSuccess("Плащ загружен!");
      onUpdate();
      await loadCapes();
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
    try {
      await window.murflame.skin.resetCape?.(account.id);
      setCurrentCape(null);
      setSuccess("Плащ сброшен!");
      onUpdate();
      await loadCapes();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOfficialCape = async (capeId: string) => {
    if (!window.murflame || !ownedCapes.includes(capeId)) return;
    setLoading(true);
    setError(null);
    try {
      await window.murflame.skin.setOfficialCape?.(account.id, capeId);
      setSuccess(`Плащ "${capeId}" установлен!`);
      onUpdate();
      await loadCapes();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "legendary": return "#ffd700";
      case "epic": return "#9b59b6";
      case "rare": return "#3498db";
      default: return "#7f8c8d";
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
          {currentCape ? (
            <img src={currentCape} alt="Current cape" className="cape-preview" />
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

      {/* Загрузка своего плаща */}
      <div className="card">
        <h3>Загрузить свой плащ</h3>
        <p className="text-muted">Размер: 22×17 пикселей, формат PNG</p>
        <div className="cape-upload">
          <button className="btn btn-secondary" onClick={handlePickCape}>
            <Upload size={16} />
            Выбрать PNG
          </button>
          {previewCapeFile && (
            <>
              <span className="file-name">{previewCapeFile.split(/[/\\]/).pop()}</span>
              <button className="btn btn-primary" onClick={handleApplyCape} disabled={loading}>
                Загрузить
              </button>
            </>
          )}
        </div>
      </div>

      {/* Официальные плащи */}
      <div className="card">
        <h3>Официальные плащи</h3>
        <div className="capes-grid">
          {OFFICIAL_CAPES.map((cape) => {
            const isOwned = ownedCapes.includes(cape.id);
            const isCurrent = currentCape?.includes(cape.id);
            
            return (
              <button
                key={cape.id}
                className={`cape-card ${isOwned ? "owned" : "locked"} ${isCurrent ? "current" : ""}`}
                onClick={() => handleSelectOfficialCape(cape.id)}
                disabled={!isOwned || loading}
              >
                <div className="cape-icon">
                  <Crown size={24} style={{ color: getRarityColor(cape.rarity) }} />
                </div>
                <div className="cape-info">
                  <div className="cape-name">{cape.name}</div>
                  <div className="cape-description">{cape.description}</div>
                  <div className="cape-rarity" style={{ color: getRarityColor(cape.rarity) }}>
                    {cape.rarity}
                  </div>
                </div>
                {isCurrent && <Check size={16} className="check-icon" />}
                {!isOwned && <Lock size={16} className="lock-icon" />}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
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
        
        .cape-actions {
          display: flex;
          gap: 8px;
        }
        
        .cape-upload {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        
        .file-name {
          font-size: 13px;
          color: var(--text-muted);
        }
        
        .capes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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
        
        .cape-card.owned {
          border-left: 3px solid #10b981;
        }
        
        .cape-card.locked {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .cape-card.current {
          border-left: 3px solid #f59e0b;
          background: rgba(245, 158, 11, 0.1);
        }
        
        .cape-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .cape-info {
          flex: 1;
        }
        
        .cape-name {
          font-weight: 600;
          margin-bottom: 4px;
        }
        
        .cape-description {
          font-size: 12px;
          color: var(--text-muted);
        }
        
        .cape-rarity {
          font-size: 11px;
          margin-top: 4px;
          text-transform: uppercase;
        }
        
        .check-icon, .lock-icon {
          margin-left: 8px;
          flex-shrink: 0;
        }
        
        .check-icon {
          color: #10b981;
        }
        
        .lock-icon {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}