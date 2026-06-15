import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Trash2, Package, Cloud, AlertTriangle } from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import { versionTypeLabel } from "../utils/versionLabels";
import { LOADER_LABELS } from "../utils/instanceUtils";
import { useLocale } from "../hooks/useLocale";

// Парсинг снапшотов: формат "26w14a" -> 2026 год, 14 неделя
function parseSnapshot(snapshot: string): { year: number; week: number; prerelease: string } | null {
  const match = snapshot.match(/^(\d{2})w(\d{2})([a-z]?)$/);
  if (match) {
    const year = 2000 + parseInt(match[1], 10);
    const week = parseInt(match[2], 10);
    const prerelease = match[3] || "";
    return { year, week, prerelease };
  }
  return null;
}

// Парсинг релизных версий: "1.20.4" -> [1, 20, 4]
function parseRelease(version: string): number[] | null {
  const match = version.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (match) {
    return [parseInt(match[1], 10), parseInt(match[2], 10), match[3] ? parseInt(match[3], 10) : 0];
  }
  return null;
}

// Основная функция для получения числового значения "веса" версии (чем больше число, тем новее)
function getVersionWeight(versionId: string, releaseTime?: string): number {
  if (releaseTime) {
    const date = new Date(releaseTime);
    if (!isNaN(date.getTime())) {
      return date.getTime() / 1000;
    }
  }

  const lowerId = versionId.toLowerCase();
  
  const snapshot = parseSnapshot(lowerId);
  if (snapshot) {
    const letterWeight = snapshot.prerelease ? snapshot.prerelease.charCodeAt(0) - 96 : 0;
    return snapshot.year * 100000 + snapshot.week * 100 + letterWeight;
  }

  const preMatch = lowerId.match(/(\d+\.\d+(?:\.\d+)?)-pre(\d+)/);
  if (preMatch) {
    const baseVersion = parseRelease(preMatch[1]);
    const preNum = parseInt(preMatch[2], 10);
    if (baseVersion) {
      const baseWeight = baseVersion[0] * 1000000 + baseVersion[1] * 10000 + baseVersion[2] * 100;
      return baseWeight + 50 + preNum;
    }
  }

  const rcMatch = lowerId.match(/(\d+\.\d+(?:\.\d+)?)-rc(\d+)/);
  if (rcMatch) {
    const baseVersion = parseRelease(rcMatch[1]);
    const rcNum = parseInt(rcMatch[2], 10);
    if (baseVersion) {
      const baseWeight = baseVersion[0] * 1000000 + baseVersion[1] * 10000 + baseVersion[2] * 100;
      return baseWeight + 20 + rcNum;
    }
  }

  const betaMatch = lowerId.match(/beta\s*(\d+\.\d+(?:\.\d+)?)/i);
  if (betaMatch) {
    const betaVer = parseRelease(betaMatch[1]);
    if (betaVer) {
      return 100000 + betaVer[0] * 10000 + betaVer[1] * 100 + betaVer[2];
    }
    return 50000;
  }

  const alphaMatch = lowerId.match(/alpha\s*(\d+\.\d+(?:\.\d+)?)/i);
  if (alphaMatch) {
    const alphaVer = parseRelease(alphaMatch[1]);
    if (alphaVer) {
      return 20000 + alphaVer[0] * 10000 + alphaVer[1] * 100 + alphaVer[2];
    }
    return 10000;
  }

  const release = parseRelease(lowerId);
  if (release) {
    return release[0] * 1000000 + release[1] * 10000 + release[2] * 100;
  }

  if (lowerId.includes("remastered") || lowerId.includes("unofficial")) {
    return -1;
  }

  return 0;
}

function sortVersionsByDate<T extends { id: string; releaseTime?: string }>(versions: T[]): T[] {
  return [...versions].sort((a, b) => {
    const weightA = getVersionWeight(a.id, a.releaseTime);
    const weightB = getVersionWeight(b.id, b.releaseTime);
    return weightB - weightA;
  });
}

export function VersionsPage() {
  const { t } = useLocale();
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
  } = useLauncherStore();

  const [installing, setInstalling] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"installed" | "available" | "unofficial">("installed");

  const versionFilter = settings?.versionFilter ?? "all";

  const installedVersions = useMemo(() => 
    sortVersionsByDate(versions.filter(v => v.installed === true)), 
    [versions]
  );
  
  const availableVersions = useMemo(() => 
    sortVersionsByDate(versions.filter(v => v.installed !== true)), 
    [versions]
  );

  const unofficialVersions = useMemo(() => 
    sortVersionsByDate([
      {
        id: "alpha-1.2.3_03-remastered",
        name: "Alpha 1.2.3_03 (remastered)",
        description: "Страшная версия с секретами | Крипипаста",
        type: "unofficial",
        downloadUrl: "https://www.dropbox.com/scl/fi/xvfy0sffk0m45eycwn084/Minecraft.zip?rlkey=ezb6q2rupd7crno0x4y8s0bgi&st=5e946anx&dl=1"
      }
    ]),
    []
  );

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
    }
  };

  const handleInstallUnofficial = async (version: typeof unofficialVersions[0]) => {
    if (!window.murflame) return;
    setInstalling(true);
    setError(null);
    try {
      await window.murflame.versions.installUnofficial?.(version.id, version.downloadUrl);
      await loadVersions();
      setActiveTab("installed");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInstalling(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.murflame) return;
    if (!confirm(t("versions.deleteConfirm")?.replace("{id}", id) || `Удалить версию ${id}?`)) return;
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
        <h2>{t("versions.title")}</h2>
        <p>{t("versions.desc")}</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="version-tabs">
        <button
          className={`version-tab ${activeTab === "installed" ? "active" : ""}`}
          onClick={() => setActiveTab("installed")}
        >
          <Package size={16} />
          {t("versions.installed")}
          {installedVersions.length > 0 && <span className="tab-count">{installedVersions.length}</span>}
        </button>
        <button
          className={`version-tab ${activeTab === "available" ? "active" : ""}`}
          onClick={() => setActiveTab("available")}
        >
          <Cloud size={16} />
          {t("versions.available")}
        </button>
        <button
          className={`version-tab ${activeTab === "unofficial" ? "active" : ""}`}
          onClick={() => setActiveTab("unofficial")}
        >
          <AlertTriangle size={16} />
          {t("versions.unofficial")}
        </button>
      </div>

      <div className="versions-toolbar">
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder={t("versions.search")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button type="button" className="btn btn-secondary" onClick={refreshVersions} disabled={listLoading}>
          <RefreshCw size={16} />
          {t("versions.refresh")}
        </button>
      </div>

      {activeTab === "available" && (
        <div className="version-filter-tabs" style={{ marginTop: 16 }}>
          {[
            { id: "all", label: t("versions.all") },
            { id: "release", label: t("versions.release") },
            { id: "snapshot", label: t("versions.snapshot") },
            { id: "old_beta", label: t("versions.beta") },
            { id: "old_alpha", label: t("versions.alpha") },
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

      {progress && (
        <div style={{ marginBottom: 12 }}>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="progress-text">{progress.message}</div>
        </div>
      )}

      <div className="versions-list">
        {activeTab === "installed" && (
          <>
            {filteredInstalled.length === 0 ? (
              <p style={{ gridColumn: "1 / -1", padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                {t("versions.noInstalled")}
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
                        <Download size={14} /> {t("versions.reinstall")}
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
                {t("versions.noAvailable")}
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
                      <Download size={14} /> {t("versions.install")}
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
                {t("versions.noUnofficial")}
              </p>
            ) : (
              filteredUnofficial.map((v) => (
                <div key={v.id} className="version-card unofficial">
                  <div className="version-card-top">
                    <div className="id">{v.name}</div>
                    <span className="version-type-badge unofficial-badge">⚠️ {t("versions.unofficial")}</span>
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
                      <Download size={14} /> {t("versions.install")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </>
  );
}