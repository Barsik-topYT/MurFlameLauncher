import { useEffect, useMemo, useState } from "react";
import {
  Play,
  Plus,
  FolderOpen,
  Pencil,
  Trash2,
  Package,
} from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import { InstanceIconView } from "../components/InstanceIconView";
import { InstanceModal } from "../components/InstanceModal";
import type { GameInstance } from "../types/api";
import {
  formatLastPlayed,
  formatPlayTime,
  instanceSubtitle,
  LOADER_LABELS,
} from "../utils/instanceUtils";

export function HomePage() {
  const {
    activeAccount,
    instances,
    selectedInstanceId,
    installedVersions,
    progress,
    setProgress,
    setError,
    error,
    loadInstances,
    setSelectedInstance,
    setPage,
  } = useLauncherStore();

  const [launching, setLaunching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editInstance, setEditInstance] = useState<GameInstance | null>(null);

  useEffect(() => {
    if (window.murflame) void loadInstances();
  }, [loadInstances]);

  const selected = useMemo(
    () => instances.find((i) => i.id === selectedInstanceId) ?? instances[0] ?? null,
    [instances, selectedInstanceId]
  );

  useEffect(() => {
    if (selected && selected.id !== selectedInstanceId) {
      setSelectedInstance(selected.id);
    }
  }, [selected, selectedInstanceId, setSelectedInstance]);

  const handleLaunch = async (inst: GameInstance) => {
    if (!activeAccount) {
      setError("Сначала добавьте аккаунт во вкладке «Аккаунты»");
      return;
    }
    setLaunching(true);
    setError(null);
    setProgress({ stage: "start", percent: 0, message: "Подготовка..." });
    try {
      await window.murflame!.instances.launch(inst.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLaunching(false);
      setTimeout(() => setProgress(null), 3000);
      void loadInstances();
    }
  };

  const handleCreate = async (data: {
    name: string;
    versionId: string;
    icon: GameInstance["icon"];
    notes?: string;
    loader?: "vanilla" | "fabric" | "forge" | "neoforge" | "quilt";
    withSodiumIris?: boolean;
    withOptifine?: boolean;
  }) => {
    const inst = await window.murflame!.instances.create(data);
    await loadInstances();
    setSelectedInstance(inst.id);
  };

  const handleUpdate = async (data: {
    name: string;
    versionId: string;
    icon: GameInstance["icon"];
    notes?: string;
  }) => {
    if (!editInstance) return;
    await window.murflame!.instances.update(editInstance.id, data);
    await loadInstances();
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`Удалить экземпляр «${selected.name}»?`)) return;
    await window.murflame!.instances.remove(selected.id);
    await loadInstances();
  };

  const openEdit = () => {
    if (!selected) return;
    setEditInstance(selected);
    setModalOpen(true);
  };

  return (
    <div className="instances-page">
      {!window.murflame && (
        <div className="alert alert-error">
          API лаунчера недоступен. Закройте окно и выполните: <strong>npm run dev</strong>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <div className="instances-toolbar">
        <div>
          <h2 className="instances-title">Экземпляры</h2>
          <p className="instances-subtitle">
            {instances.length > 0
              ? `${instances.length} установок`
              : "Создайте экземпляр или установите Forge/Fabric во вкладке «Версии»"}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditInstance(null);
            setModalOpen(true);
          }}
        >
          <Plus size={18} />
          Добавить экземпляр
        </button>
      </div>

      <div className="instances-layout">
        <div className="instances-grid-wrap">
          {instances.length === 0 ? (
            <div className="instances-empty">
              <Package size={48} strokeWidth={1.2} />
              <h3>Нет экземпляров</h3>
              <p>
                Установите версию Minecraft или Forge/Fabric во вкладке «Версии» — экземпляр
                создастся автоматически.
              </p>
              <button type="button" className="btn btn-secondary" onClick={() => setPage("versions")}>
                Перейти к версиям
              </button>
            </div>
          ) : (
            <div className="instances-grid">
              {instances.map((inst) => (
                <button
                  key={inst.id}
                  type="button"
                  className={`instance-card ${selected?.id === inst.id ? "selected" : ""}`}
                  onClick={() => setSelectedInstance(inst.id)}
                  onDoubleClick={() => handleLaunch(inst)}
                >
                  <InstanceIconView icon={inst.icon} size={52} />
                  <div className="instance-card-name">{inst.name}</div>
                  <div className="instance-card-meta">{instanceSubtitle(inst)}</div>
                  {inst.lastPlayed && (
                    <div className="instance-card-played">
                      {formatLastPlayed(inst.lastPlayed)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <aside className="instance-sidebar">
            <InstanceIconView icon={selected.icon} size={72} className="instance-sidebar-icon" />
            <h3 className="instance-sidebar-name">{selected.name}</h3>
            <div className="instance-sidebar-version">{selected.versionId}</div>
            <div className="instance-sidebar-badge">{LOADER_LABELS[selected.loader]}</div>

            <button
              type="button"
              className="btn btn-primary btn-launch-instance"
              onClick={() => handleLaunch(selected)}
              disabled={launching || !activeAccount}
            >
              <Play size={20} fill="currentColor" />
              {launching ? "Запуск…" : "Запустить"}
            </button>

            <ul className="instance-actions">
              <li>
                <button type="button" className="instance-action-btn" onClick={openEdit}>
                  <Pencil size={16} />
                  Изменить…
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="instance-action-btn"
                  onClick={() => window.murflame?.instances.openFolder(selected.id)}
                >
                  <FolderOpen size={16} />
                  Папка
                </button>
              </li>
              <li>
                <button type="button" className="instance-action-btn danger" onClick={handleDelete}>
                  <Trash2 size={16} />
                  Удалить
                </button>
              </li>
            </ul>

            <div className="instance-stats">
              <div>
                <span className="label">Последний запуск</span>
                <span>{formatLastPlayed(selected.lastPlayed)}</span>
              </div>
              <div>
                <span className="label">Время в игре</span>
                <span>{formatPlayTime(selected.playTimeMs)}</span>
              </div>
            </div>
          </aside>
        )}
      </div>

      {progress && (
        <div className="instances-progress">
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="progress-text">{progress.message}</div>
        </div>
      )}

      <InstanceModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditInstance(null);
        }}
        onSave={editInstance ? handleUpdate : handleCreate}
        edit={editInstance}
        installedVersions={installedVersions}
        openInstanceFolder={(id: string) => {
          const inst = instances.find(i => i.id === id);
          if (inst) window.murflame?.instances.openFolder(inst.id);
        }}
      />
    </div>
  );
}
