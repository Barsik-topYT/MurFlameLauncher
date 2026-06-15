import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Search,
  Download,
  Check,
  Loader2,
  AlertTriangle,
  Calendar,
  ThumbsUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Trash2
} from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import type { ModrinthProject, CurseForgeProject } from "../types/api";
import { useLocale } from "../hooks/useLocale";

const COMMON_VERSIONS = [
  "1.21",
  "1.20.6",
  "1.20.4",
  "1.20.2",
  "1.20.1",
  "1.20",
  "1.19.4",
  "1.19.2",
  "1.18.2",
  "1.17.1",
  "1.16.5",
  "1.12.2",
  "1.8.9",
  "1.7.10",
];

const LOADERS = ["fabric", "forge", "neoforge", "quilt"];

export function ModsPage() {
  const { t } = useLocale();
  const { instances, selectedInstanceId, setSelectedInstance } = useLauncherStore();

  const activeInstance = useMemo(() => {
    return instances.find((i) => i.id === selectedInstanceId) || instances[0] || null;
  }, [instances, selectedInstanceId]);

  const [platform, setPlatform] = useState<"modrinth" | "curseforge">("modrinth");
  const [query, setQuery] = useState("");
  const [versionFilter, setVersionFilter] = useState("");
  const [loaderFilter, setLoaderFilter] = useState("");
  const [modrinthMods, setModrinthMods] = useState<ModrinthProject[]>([]);
  const [curseforgeMods, setCurseforgeMods] = useState<CurseForgeProject[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const limit = 20;
  const [installedModsFiles, setInstalledModsFiles] = useState<string[]>([]);
  const [installedModsMap, setInstalledModsMap] = useState<Record<string, string>>({});
  const [installState, setInstallState] = useState<
    Record<
      string,
      Record<string, { status: "idle" | "installing" | "installed" | "error"; error?: string }>
    >
  >({});

  const versionsList = useMemo(() => {
    const fromInstances = instances.map((i) => i.mcVersion).filter(Boolean);
    const combined = new Set([...fromInstances, ...COMMON_VERSIONS]);
    return Array.from(combined).sort((a, b) => {
      const parse = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
      const ap = parse(a);
      const bp = parse(b);
      for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
        const av = ap[i] || 0;
        const bv = bp[i] || 0;
        if (av !== bv) return bv - av;
      }
      return 0;
    });
  }, [instances]);

  const loadInstalledMods = useCallback(async () => {
    if (!activeInstance || !window.murflame) return;
    try {
      const data = await window.murflame.mods.listInstalled(activeInstance.id);
      setInstalledModsFiles(data.files);
      setInstalledModsMap(data.map);
    } catch (e) {
      console.error("Failed to load installed mods:", e);
    }
  }, [activeInstance]);

  useEffect(() => {
    if (activeInstance) {
      setVersionFilter(activeInstance.mcVersion);
      const loader = activeInstance.loader === "vanilla" ? "" : activeInstance.loader;
      setLoaderFilter(loader);
      loadInstalledMods();
    }
  }, [activeInstance, loadInstalledMods]);

  const performSearch = useCallback(
    async (searchQuery: string, ver: string, load: string, pageOffset = 0) => {
      if (!window.murflame) return;
      setSearching(true);
      setSearchError(null);
      try {
        if (platform === "modrinth") {
          const res = await window.murflame.modrinth.search(
            searchQuery,
            ver || undefined,
            load || undefined,
            pageOffset,
            limit
          );
          setModrinthMods(res.hits);
          setTotalHits(res.total_hits);
        } else {
          const res = await window.murflame.curseforge.search(
            searchQuery,
            ver || undefined,
            load || undefined,
            pageOffset,
            limit
          );
          setCurseforgeMods(res.hits);
          setTotalHits(res.total_hits);
        }
        setOffset(pageOffset);
      } catch (e) {
        setSearchError((e as Error).message || t("mods.searchError") || "Не удалось загрузить моды");
      } finally {
        setSearching(false);
      }
    },
    [limit, platform, t]
  );

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      performSearch(query, versionFilter, loaderFilter, 0);
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [query, versionFilter, loaderFilter, platform, performSearch]);

  const handlePageChange = (direction: "prev" | "next") => {
    let newOffset = offset;
    if (direction === "prev") {
      newOffset = Math.max(0, offset - limit);
    } else {
      if (offset + limit < totalHits) {
        newOffset = offset + limit;
      }
    }
    if (newOffset !== offset) {
      performSearch(query, versionFilter, loaderFilter, newOffset);
    }
  };

  const handleInstall = async (projectId: string, fileId?: string) => {
    if (!activeInstance) return;
    const instId = activeInstance.id;
    setInstallState((prev) => ({
      ...prev,
      [instId]: {
        ...(prev[instId] || {}),
        [projectId]: { status: "installing" },
      },
    }));
    try {
      let success: boolean;
      if (platform === "modrinth") {
        success = await window.murflame!.modrinth.installMod(projectId, instId);
      } else {
        if (!fileId) throw new Error("No file ID provided for CurseForge mod");
        success = await window.murflame!.curseforge.installMod(projectId, fileId, instId);
      }
      if (success) {
        setInstallState((prev) => ({
          ...prev,
          [instId]: {
            ...(prev[instId] || {}),
            [projectId]: { status: "installed" },
          },
        }));
        await loadInstalledMods();
      } else {
        throw new Error(t("mods.downloadFailed") || "Не удалось скачать файл мода");
      }
    } catch (e) {
      const errMsg = (e as Error).message || t("mods.installError") || "Ошибка при установке";
      setInstallState((prev) => ({
        ...prev,
        [instId]: {
          ...(prev[instId] || {}),
          [projectId]: { status: "error", error: errMsg },
        },
      }));
    }
  };

  const handleRemoveMod = async (fileName: string, projectId: string) => {
    if (!activeInstance) return;
    try {
      const projectKeyFull = `${platform}:${projectId}`;
      await window.murflame!.mods.removeMod(activeInstance.id, fileName, projectKeyFull);
      await loadInstalledMods();
      setInstallState((prev) => {
        const newState = { ...prev };
        if (newState[activeInstance.id]) {
          delete newState[activeInstance.id][projectId];
        }
        return newState;
      });
    } catch (e) {
      console.error("Failed to remove mod:", e);
    }
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalHits / limit) || 1;

  const formatCount = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const getInstalledFileName = (mod: ModrinthProject | CurseForgeProject) => {
    const key = `${platform}:${mod.id}`;
    if (installedModsMap[key]) return installedModsMap[key];
    const modTitleLower = mod.title.toLowerCase();
    return installedModsFiles.find(file => {
      const fileLower = file.toLowerCase().replace('.jar', '').replace('.litemod', '');
      return modTitleLower.includes(fileLower) || fileLower.includes(modTitleLower);
    });
  };

  const currentMods = platform === "modrinth" ? modrinthMods : curseforgeMods;

  return (
    <div className="mods-page">
      <div className="mods-header">
        <div>
          <h2>{t("mods.title")}</h2>
          <p className="mods-subtitle">
            {t("mods.desc").replace("{platform}", platform === "modrinth" ? "Modrinth" : "CurseForge")}
          </p>
        </div>
        <div className="mods-instance-picker">
          <span className="picker-label">{t("mods.instance")}</span>
          {instances.length === 0 ? (
            <span className="picker-empty">{t("mods.noInstance")}</span>
          ) : (
            <select
              value={selectedInstanceId || ""}
              onChange={(e) => setSelectedInstance(e.target.value)}
              className="mods-select border-glow"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.mcVersion} · {inst.loader})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {activeInstance && activeInstance.loader === "vanilla" && (
        <div className="mods-warning">
          <AlertTriangle size={16} className="warning-icon" />
          <span>{t("mods.warning")}</span>
        </div>
      )}
      <div className="mods-toolbar border-glow">
        <div className="flex gap-2">
          <button
            className={`btn ${platform === "modrinth" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setPlatform("modrinth")}
          >
            Modrinth
          </button>
          <button
            className={`btn ${platform === "curseforge" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setPlatform("curseforge")}
          >
            CurseForge
          </button>
        </div>
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder={t("mods.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          {query && (
            <button type="button" className="clear-btn" onClick={() => setQuery("")}>✕</button>
          )}
        </div>
        <div className="filters-group">
          <select
            value={versionFilter}
            onChange={(e) => setVersionFilter(e.target.value)}
            className="mods-select"
          >
            <option value="">Любая версия MC</option>
            {versionsList.map((ver) => (
              <option key={ver} value={ver}>Minecraft {ver}</option>
            ))}
          </select>
          <select
            value={loaderFilter}
            onChange={(e) => setLoaderFilter(e.target.value)}
            className="mods-select"
          >
            <option value="">Любой загрузчик</option>
            {LOADERS.map((load) => (
              <option key={load} value={load}>{load.charAt(0).toUpperCase() + load.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mods-content">
        {searching && currentMods.length === 0 ? (
          <div className="mods-loading">
            <Loader2 size={36} className="spin" />
            <p>{t("mods.loading") || "Загрузка списка модов..."}</p>
          </div>
        ) : searchError ? (
          <div className="mods-error">
            <AlertTriangle size={36} />
            <p>{searchError}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => performSearch(query, versionFilter, loaderFilter, offset)}
            >
              {t("mods.retry") || "Повторить попытку"}
            </button>
          </div>
        ) : currentMods.length === 0 ? (
          <div className="mods-empty">
            <AlertTriangle size={40} />
            <p>{t("mods.noResults") || "По вашему запросу ничего не найдено"}</p>
          </div>
        ) : (
          <div className="mods-list-wrapper">
            <div className="mods-list">
              {currentMods.map((mod) => {
                const instId = activeInstance?.id || "";
                const state = installState[instId]?.[mod.id] || { status: "idle" };
                const isCurseForge = platform === "curseforge";
                const installedFileName = getInstalledFileName(mod);
                return (
                  <div key={mod.id} className="mod-card border-glow-hover">
                    {mod.icon_url ? (
                      <img src={mod.icon_url} alt={mod.title} className="mod-icon" />
                    ) : (
                      <div className="mod-icon-placeholder">🧩</div>
                    )}
                    <div className="mod-info">
                      <div className="mod-title-row">
                        <span className="mod-title">{mod.title}</span>
                        {mod.author && <span className="mod-author">от {mod.author}</span>}
                      </div>
                      <p className="mod-description">{mod.description}</p>
                      <div className="mod-meta-row">
                        <div className="mod-categories">
                          {mod.categories?.slice(0, 3).map((cat, idx) => (
                            <span key={`${cat}-${idx}`} className="mod-category-badge">{cat}</span>
                          ))}
                        </div>
                        <div className="mod-stats">
                          <span title={t("mods.downloads") || "Скачиваний"}>
                            <Download size={12} /> {formatCount(mod.downloads)}
                          </span>
                          <span title={t("mods.followers") || "Подписчиков"}>
                            <ThumbsUp size={12} /> {formatCount(mod.followers)}
                          </span>
                          {mod.date_modified && (
                            <span title={t("mods.updated") || "Обновлен"}>
                              <Calendar size={12} /> {formatDate(mod.date_modified)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mod-action">
                      <a
                        href={isCurseForge
                          ? `https://www.curseforge.com/minecraft/mc-mods/${mod.slug}`
                          : `https://modrinth.com/mod/${mod.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="modrinth-link-icon"
                        title={`Открыть на ${platform === "modrinth" ? "Modrinth" : "CurseForge"}`}
                        onClick={(e) => {
                          e.preventDefault();
                          window.murflame?.shell.open(isCurseForge
                            ? `https://www.curseforge.com/minecraft/mc-mods/${mod.slug}`
                            : `https://modrinth.com/mod/${mod.slug}`);
                        }}
                      >
                        <ExternalLink size={16} />
                      </a>
                      {installedFileName && (
                        <button
                          type="button"
                          className="btn btn-danger mod-download-btn"
                          disabled={!activeInstance}
                          onClick={() => handleRemoveMod(installedFileName, mod.id)}
                        >
                          <Trash2 size={14} />
                          {t("mods.remove") || "Удалить"}
                        </button>
                      )}
                      {!installedFileName && state.status === "idle" && (
                        <button
                          type="button"
                          className="btn btn-primary mod-download-btn"
                          disabled={!activeInstance}
                          onClick={() => handleInstall(
                            mod.id,
                            isCurseForge ? (mod as CurseForgeProject).latest_file_id : undefined
                          )}
                        >
                          <Download size={14} />
                          {t("mods.download") || "Скачать"}
                        </button>
                      )}
                      {!installedFileName && state.status === "installing" && (
                        <button
                          type="button"
                          className="btn btn-secondary mod-download-btn"
                          disabled
                        >
                          <Loader2 size={14} className="spin" />
                          {t("mods.installing") || "Установка..."}
                        </button>
                      )}
                      {!installedFileName && state.status === "installed" && (
                        <div className="mod-status-success" title={t("mods.installedTitle") || "Мод успешно скачан и установлен"}>
                          <Check size={16} />
                          {t("mods.installed") || "Установлено"}
                        </div>
                      )}
                      {!installedFileName && state.status === "error" && (
                        <div className="mod-status-error" title={state.error}>
                          <AlertTriangle size={14} />
                          {t("mods.error") || "Ошибка"}
                          <button
                            type="button"
                            className="mod-retry-btn"
                            onClick={() => handleInstall(
                              mod.id,
                              isCurseForge ? (mod as CurseForgeProject).latest_file_id : undefined
                            )}
                            title={t("mods.retry") || "Повторить попытку"}
                          >
                            🔄
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mods-pagination">
              <button
                type="button"
                className="pagination-btn"
                disabled={offset === 0 || searching}
                onClick={() => handlePageChange("prev")}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="pagination-info">
                {t("mods.page") || "Страница"} {currentPage} {t("mods.of") || "из"} {totalPages} ({totalHits} {t("mods.mods") || "модов"})
              </span>
              <button
                type="button"
                className="pagination-btn"
                disabled={offset + limit >= totalHits || searching}
                onClick={() => handlePageChange("next")}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}