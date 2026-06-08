import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Trash2, X, Package, Cloud, AlertTriangle } from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import { versionTypeLabel } from "../utils/versionLabels";
import { LOADER_LABELS } from "../utils/instanceUtils";

export function VersionsPage() {
  const {
    versions,
    selectedVersion,
    setSelectedVersion,
    loadVersions,
    setError,
    error,
    settings,
    updateSettings,
    progress,
    loading,
    isDownloading,
    cancelDownload,
  } = useLauncherStore();

  const [installing, setInstalling] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"installed" | "available" | "unofficial">("installed");

  const versionFilter = settings?.versionFilter ?? "all";

  // Разделяем версии
  const installedVersions = useMemo(() => versions.filter(v => v.installed === true), [versions]);
  const availableVersions = useMemo(() => versions.filter(v => v.installed !== true), [versions]);

  // Неофициальные версии
const unofficialVersions = useMemo(() => [
  {
    id: "alpha-1.2.3_03-remastered",
    name: "Alpha 1.2.3_03 (remastered)",
    description: "Страшная версия с секретами | Крипипаста",
    type: "unofficial",
    downloadUrl: "https://www.dropbox.com/scl/fi/xvfy0sffk0m45eycwn084/Minecraft.zip?rlkey=ezb6q2rupd7crno0x4y8s0bgi&st=5e946anx&dl=1"
  }
], []);

  const refreshVersions = async () => {
    setListLoading(true);
    setError(null);
    try {
      await loadVersions();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (window.murflame && versions.length === 0) {
      void refreshVersions();
    }
  }, []);

  const filteredInstalled = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return installedVersions;
    return installedVersions.filter((v) => v.id.toLowerCase().includes(q));
  }, [installedVersions, filter]);

  const filteredAvailable = useMemo(() => {
    const q = filter.toLowerCase().trim();
    let filtered = availableVersions;
    if (q) filtered = filtered.filter((v) => v.id.toLowerCase().includes(q));
    if (versionFilter !== "all") {
      filtered = filtered.filter((v) => v.type === versionFilter);
    }
    return filtered;
  }, [availableVersions, filter, versionFilter]);

  const filteredUnofficial = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return unofficialVersions;
    return unofficialVersions.filter((v) => 
      v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q)
    );
  }, [unofficialVersions, filter]);

  const handleInstall = async (id: string) => {
    if (!window.murflame) return;
    setInstalling(true);
    setError(null);
    try {
      await window.murflame.versions.install(id);
      await loadVersions();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInstalling(false);
      useLauncherStore.getState().setProgress(null);
      useLauncherStore.getState().cancelDownload();
    }
  };

  const handleInstallUnofficial = async (version: typeof unofficialVersions[0]) => {
    if (!window.murflame) return;
    setInstalling(true);
    setError(null);
    try {
      await window.murflame.versions.installUnofficial?.(version.id, version.downloadUrl);
      await loadVersions();
      setActiveTab("installed"); // Переключаем на установленные после установки
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInstalling(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.murflame) return;
    if (!confirm(`Удалить версию ${id}?`)) return;
    setError(null);
    try {
      await window.murflame.versions.delete(id);
      await loadVersions();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const setVersionFilter = (vf: string) => {
    updateSettings({ versionFilter: vf as any });
  };

  return (
    <>
      <div className="page-header">
        <h2>Версии Minecraft</h2>
        <p>Управление установленными, доступными и неофициальными версиями</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Вкладки */}
      <div className="version-tabs">
        <button
          className={`version-tab ${activeTab === "installed" ? "active" : ""}`}
          onClick={() => setActiveTab("installed")}
        >
          <Package size={16} />
          Установленные
          {installedVersions.length > 0 && <span className="tab-count">{installedVersions.length}</span>}
        </button>
        <button
          className={`version-tab ${activeTab === "available" ? "active" : ""}`}
          onClick={() => setActiveTab("available")}
        >
          <Cloud size={16} />
          Доступные
        </button>
        <button
          className={`version-tab ${activeTab === "unofficial" ? "active" : ""}`}
          onClick={() => setActiveTab("unofficial")}
        >
          <AlertTriangle size={16} />
          Неофициальные
        </button>
      </div>

      {/* Поиск */}
      <div className="versions-toolbar">
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Поиск версии..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button type="button" className="btn btn-secondary" onClick={refreshVersions} disabled={listLoading}>
          <RefreshCw size={16} />
          Обновить
        </button>
      </div>

      {/* Фильтр для доступных версий */}
      {activeTab === "available" && (
        <div className="version-filter-tabs" style={{ marginTop: 16 }}>
          {[
            { id: "all", label: "Все" },
            { id: "release", label: "Релизы" },
            { id: "snapshot", label: "Снапшоты" },
            { id: "old_beta", label: "Beta" },
            { id: "old_alpha", label: "Alpha" },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`version-filter-tab ${versionFilter === id ? "active" : ""}`}
              onClick={() => setVersionFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Прогресс */}
      {progress && (
        <div style={{ marginBottom: 12 }}>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="progress-text">{progress.message}</div>
        </div>
      )}

      {/* Списки версий */}
      <div className="versions-list">
        {activeTab === "installed" && (
          <>
            {filteredInstalled.length === 0 ? (
              <p style={{ gridColumn: "1 / -1", padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                Нет установленных версий. Перейдите на вкладку "Доступные".
              </p>
            ) : (
              filteredInstalled.map((v) => (
                <div key={v.id} className="version-card installed">
                  <div className="version-card-top">
                    <div className="id">{v.id}</div>
                    <span className="version-check">✓</span>
                  </div>
                  <div className="meta">
                    <span className={`version-type-badge ${v.type}`}>
                      {LOADER_LABELS[v.type as keyof typeof LOADER_LABELS] ?? versionTypeLabel(v.type)}
                    </span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn btn-ghost version-install-btn" onClick={() => handleInstall(v.id)} disabled={installing}>
                        <Download size={14} /> Переустановить
                      </button>
                      <button className="btn btn-ghost version-install-btn" style={{ color: "var(--danger)" }} onClick={() => handleDelete(v.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "available" && (
          <>
            {filteredAvailable.length === 0 ? (
              <p style={{ gridColumn: "1 / -1", padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                Версии не найдены.
              </p>
            ) : (
              filteredAvailable.map((v) => (
                <div key={v.id} className={`version-card ${selectedVersion === v.id ? "selected" : ""}`}
                  onClick={() => setSelectedVersion(v.id)}>
                  <div className="version-card-top">
                    <div className="id">{v.id}</div>
                  </div>
                  <div className="meta">
                    <span className={`version-type-badge ${v.type}`}>
                      {versionTypeLabel(v.type)}
                    </span>
                    <button className="btn btn-primary version-install-btn" onClick={(e) => { e.stopPropagation(); handleInstall(v.id); }} disabled={installing}>
                      <Download size={14} /> Установить
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "unofficial" && (
          <>
            {filteredUnofficial.length === 0 ? (
              <p style={{ gridColumn: "1 / -1", padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                Неофициальные версии не найдены.
              </p>
            ) : (
              filteredUnofficial.map((v) => (
                <div key={v.id} className="version-card unofficial">
                  <div className="version-card-top">
                    <div className="id">{v.name}</div>
                    <span className="version-type-badge unofficial-badge">⚠️ Неофициальная</span>
                  </div>
                  <div className="meta">
                    <div className="version-description">
                      <span className="version-type-badge">{v.type}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>
                        {v.description}
                      </span>
                    </div>
                    <button 
                      className="btn btn-primary version-install-btn" 
                      onClick={() => handleInstallUnofficial(v)}
                      disabled={installing}
                    >
                      <Download size={14} /> Установить
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      <style>{`
        .version-tabs { 
          display: flex; 
          gap: 8px; 
          margin-bottom: 24px; 
          border-bottom: 1px solid var(--border-color); 
        }
        .version-tab { 
          display: flex; 
          align-items: center; 
          gap: 8px; 
          padding: 10px 20px; 
          background: none; 
          border: none; 
          font-size: 14px; 
          color: var(--text-muted); 
          cursor: pointer; 
          border-bottom: 2px solid transparent; 
        }
        .version-tab.active { 
          color: var(--accent); 
          border-bottom-color: var(--accent); 
        }
        .tab-count { 
          background: var(--bg-secondary); 
          padding: 2px 8px; 
          border-radius: 20px; 
          font-size: 12px; 
        }
        .version-card.installed { 
          border-left: 3px solid #10b981; 
        }
        .version-card.unofficial { 
          border-left: 3px solid #f59e0b; 
          background: rgba(245, 158, 11, 0.05);
        }
        .unofficial-badge {
          background: #f59e0b;
          color: #1a1a2e;
        }
        .version-description {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .version-card .meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          gap: 10px;
          font-size: 13px;
          color: var(--text-muted);
          flex-wrap: wrap;
        }
        .version-install-btn {
          padding: 6px 12px !important;
          font-size: 12px !important;
          gap: 6px;
          white-space: nowrap;
        }
      `}</style>
    </>
  );
}