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
  Info,
  ExternalLink,
} from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import type { ModrinthProject } from "../types/api";

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
  const { instances, selectedInstanceId, setSelectedInstance } = useLauncherStore();

  // Active instance memo
  const activeInstance = useMemo(() => {
    return instances.find((i) => i.id === selectedInstanceId) || instances[0] || null;
  }, [instances, selectedInstanceId]);

  // Filters state
  const [query, setQuery] = useState("");
  const [versionFilter, setVersionFilter] = useState("");
  const [loaderFilter, setLoaderFilter] = useState("");

  // Mod lists and paginations
  const [mods, setMods] = useState<ModrinthProject[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const limit = 20;

  // Track installs: [instanceId][projectId] = { status, error }
  const [installState, setInstallState] = useState<
    Record<
      string,
      Record<string, { status: "idle" | "installing" | "installed" | "error"; error?: string }>
    >
  >({});

  // Dynamic Minecraft versions list combining COMMON_VERSIONS and instances' versions
  const versionsList = useMemo(() => {
    const fromInstances = instances.map((i) => i.mcVersion).filter(Boolean);
    const combined = new Set([...fromInstances, ...COMMON_VERSIONS]);
    return Array.from(combined).sort((a, b) => {
      // Simple semver comparison helper (descending order)
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

  // Synchronize filters with the active instance on load/change
  useEffect(() => {
    if (activeInstance) {
      setVersionFilter(activeInstance.mcVersion);
      // Map vanilla loader to fabric or keep it empty for generic mods
      const loader = activeInstance.loader === "vanilla" ? "" : activeInstance.loader;
      setLoaderFilter(loader);
    }
  }, [activeInstance]);

  // Perform search
  const performSearch = useCallback(
    async (searchQuery: string, ver: string, load: string, pageOffset = 0) => {
      if (!window.murflame) return;
      setSearching(true);
      setSearchError(null);
      try {
        const res = await window.murflame.modrinth.search(
          searchQuery,
          ver || undefined,
          load || undefined,
          pageOffset,
          limit
        );
        setMods(res.hits);
        setTotalHits(res.total_hits);
        setOffset(pageOffset);
      } catch (e) {
        setSearchError((e as Error).message || "Не удалось загрузить моды");
      } finally {
        setSearching(false);
      }
    },
    [limit]
  );

  // Search trigger when inputs change (debounced for text query)
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      performSearch(query, versionFilter, loaderFilter, 0);
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [query, versionFilter, loaderFilter, performSearch]);

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

  const handleInstall = async (projectId: string) => {
    if (!activeInstance) return;
    const instId = activeInstance.id;

    // Update state to installing
    setInstallState((prev) => ({
      ...prev,
      [instId]: {
        ...(prev[instId] || {}),
        [projectId]: { status: "installing" },
      },
    }));

    try {
      const success = await window.murflame!.modrinth.installMod(projectId, instId);
      if (success) {
        setInstallState((prev) => ({
          ...prev,
          [instId]: {
            ...(prev[instId] || {}),
            [projectId]: { status: "installed" },
          },
        }));
      } else {
        throw new Error("Не удалось скачать файл мода");
      }
    } catch (e) {
      const errMsg = (e as Error).message || "Ошибка при установке";
      setInstallState((prev) => ({
        ...prev,
        [instId]: {
          ...(prev[instId] || {}),
          [projectId]: { status: "error", error: errMsg },
        },
      }));
    }
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalHits / limit) || 1;

  // Format big numbers like downloads (e.g. 178.93M or 23.4K)
  const formatCount = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Format date modified to a readable format
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="mods-page">
      <div className="mods-header">
        <div>
          <h2>Модификации</h2>
          <p className="mods-subtitle">
            Ищите и скачивайте моды напрямую из Modrinth в один клик
          </p>
        </div>

        {/* Active Instance Selection */}
        <div className="mods-instance-picker">
          <span className="picker-label">Экземпляр:</span>
          {instances.length === 0 ? (
            <span className="picker-empty">Создайте экземпляр в меню «Экземпляры»</span>
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

      {/* Warning for Vanilla instance */}
      {activeInstance && activeInstance.loader === "vanilla" && (
        <div className="mods-warning">
          <Info size={16} className="warning-icon" />
          <span>
            Выбран чистый экземпляр <strong>Vanilla</strong>. Чтобы моды запускались, рекомендуется
            перейти во вкладку «Экземпляры», нажать «Изменить» и установить загрузчик Fabric или Forge.
          </span>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="mods-toolbar border-glow">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Поиск модов..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          {query && (
            <button type="button" className="clear-btn" onClick={() => setQuery("")}>
              ✕
            </button>
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
              <option key={ver} value={ver}>
                Minecraft {ver}
              </option>
            ))}
          </select>

          <select
            value={loaderFilter}
            onChange={(e) => setLoaderFilter(e.target.value)}
            className="mods-select"
          >
            <option value="">Любой загрузчик</option>
            {LOADERS.map((load) => (
              <option key={load} value={load}>
                {load.charAt(0).toUpperCase() + load.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Mods Content */}
      <div className="mods-content">
        {searching && mods.length === 0 ? (
          <div className="mods-loading">
            <Loader2 size={36} className="spin" />
            <p>Загрузка списка модов...</p>
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
              Повторить попытку
            </button>
          </div>
        ) : mods.length === 0 ? (
          <div className="mods-empty">
            <Info size={40} />
            <p>По вашему запросу ничего не найдено</p>
          </div>
        ) : (
          <div className="mods-list-wrapper">
            <div className="mods-list">
              {mods.map((mod) => {
                const instId = activeInstance?.id || "";
                const state = installState[instId]?.[mod.id] || { status: "idle" };

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
                          {mod.categories?.slice(0, 3).map((cat) => (
                            <span key={cat} className="mod-category-badge">
                              {cat}
                            </span>
                          ))}
                        </div>

                        <div className="mod-stats">
                          <span title="Скачивания">
                            <Download size={12} /> {formatCount(mod.downloads)}
                          </span>
                          <span title="Подписчики">
                            <ThumbsUp size={12} /> {formatCount(mod.followers)}
                          </span>
                          {mod.date_modified && (
                            <span title="Обновлен">
                              <Calendar size={12} /> {formatDate(mod.date_modified)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mod-action">
                      <a
                        href={`https://modrinth.com/mod/${mod.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="modrinth-link-icon"
                        title="Открыть на Modrinth"
                        onClick={(e) => {
                          e.preventDefault();
                          window.murflame?.shell.open(`https://modrinth.com/mod/${mod.slug}`);
                        }}
                      >
                        <ExternalLink size={16} />
                      </a>

                      {state.status === "idle" && (
                        <button
                          type="button"
                          className="btn btn-primary mod-download-btn"
                          disabled={!activeInstance}
                          onClick={() => handleInstall(mod.id)}
                        >
                          <Download size={14} />
                          Скачать
                        </button>
                      )}

                      {state.status === "installing" && (
                        <button
                          type="button"
                          className="btn btn-secondary mod-download-btn"
                          disabled
                        >
                          <Loader2 size={14} className="spin" />
                          Установка...
                        </button>
                      )}

                      {state.status === "installed" && (
                        <div className="mod-status-success" title="Мод успешно скачан и установлен">
                          <Check size={16} />
                          Установлено
                        </div>
                      )}

                      {state.status === "error" && (
                        <div className="mod-status-error" title={state.error}>
                          <AlertTriangle size={14} />
                          Ошибка
                          <button
                            type="button"
                            className="mod-retry-btn"
                            onClick={() => handleInstall(mod.id)}
                            title="Повторить попытку"
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

            {/* Pagination footer */}
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
                Страница {currentPage} из {totalPages} ({totalHits} модов)
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
