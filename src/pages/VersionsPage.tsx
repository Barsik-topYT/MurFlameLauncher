import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Trash2, X } from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import {
  VERSION_FILTER_OPTIONS,
  versionTypeLabel,
} from "../utils/versionLabels";
import { LOADER_LABELS } from "../utils/instanceUtils";
import type { VersionFilter } from "../utils/versionLabels";

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

  const versionFilter = settings?.versionFilter ?? "all";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return versions;
    return versions.filter((v) => v.id.toLowerCase().includes(q));
  }, [versions, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: versions.length };
    for (const v of versions) {
      c[v.type] = (c[v.type] ?? 0) + 1;
    }
    return c;
  }, [versions]);

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
      // Сбрасываем прогресс после завершения
      useLauncherStore.getState().setProgress(null);
      useLauncherStore.getState().cancelDownload();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.murflame) return;
    if (!confirm(`Вы действительно хотите удалить версию ${id}?`)) return;
    setError(null);
    try {
      await window.murflame.versions.delete(id);
      await loadVersions();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const setVersionFilter = (vf: VersionFilter) => {
    updateSettings({ versionFilter: vf }).then(refreshVersions);
  };

  return (
    <>
      <div className="page-header">
        <h2>Версии Minecraft</h2>
        <p>
          Все версии из официального манифеста Mojang
          {versions.length > 0 && ` — ${versions.length} шт.`}
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="versions-toolbar">
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Поиск версии..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={refreshVersions}
          disabled={listLoading}
        >
          <RefreshCw size={16} />
          Обновить
        </button>
      </div>

      <div className="version-filter-tabs" style={{ marginTop: 16 }}>
        {VERSION_FILTER_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`version-filter-tab ${versionFilter === id ? "active" : ""}`}
            onClick={() => setVersionFilter(id)}
          >
            {label}
            <span className="count">
              {id === "all" ? counts.all ?? 0 : counts[id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {progress && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="progress-text">{progress.message}</div>
            </div>
            {isDownloading && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => cancelDownload()}
                title="Отменить скачивание"
                style={{ color: "var(--danger)", padding: 8 }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="versions-list">
        {(listLoading || loading) && versions.length === 0 && (
          <p style={{ color: "var(--text-muted)", gridColumn: "1 / -1", padding: 24 }}>
            Загрузка списка версий с Mojang…
          </p>
        )}
        {!listLoading && !loading && filtered.length === 0 && (
          <p style={{ color: "var(--text-muted)", gridColumn: "1 / -1", padding: 24 }}>
            Версии не найдены. Смените фильтр или проверьте интернет.
          </p>
        )}
        {filtered.map((v) => {
          const isLoader = ["forge", "fabric", "quilt", "neoforge", "optifine", "custom"].includes(
            v.type
          );
          return (
          <div
            key={v.id}
            className={`version-card ${selectedVersion === v.id ? "selected" : ""} ${v.installed ? "is-installed" : ""}`}
            onClick={() => setSelectedVersion(v.id)}
            onKeyDown={(e) => e.key === "Enter" && setSelectedVersion(v.id)}
            role="button"
            tabIndex={0}
          >
            <div className="version-card-top">
              <div className="id">{v.id}</div>
              {v.installed && <span className="version-check">✓</span>}
            </div>
            <div className="meta">
              <span className={`version-type-badge ${v.type}`}>
                {isLoader ? LOADER_LABELS[v.type as keyof typeof LOADER_LABELS] ?? v.type : versionTypeLabel(v.type)}
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btn-ghost version-install-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleInstall(v.id);
                  }}
                  disabled={installing}
                >
                  <Download size={14} />
                  {v.installed ? "Переустановить" : "Установить"}
                </button>
                {v.installed && (
                  <button
                    type="button"
                    className="btn btn-ghost version-install-btn"
                    style={{ color: "var(--danger)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(v.id);
                    }}
                    title="Удалить версию"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );})}
      </div>
    </>
  );
}
