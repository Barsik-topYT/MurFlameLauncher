import { useEffect, useState } from "react";
import { X, FolderOpen, Loader2 } from "lucide-react";
import type { GameInstance, InstanceIcon } from "../vite-env.d";
import { ICON_OPTIONS } from "../utils/instanceUtils";
import { InstanceIconView } from "./InstanceIconView";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    versionId: string;
    icon: InstanceIcon;
    notes?: string;
    loader?: "vanilla" | "fabric" | "forge" | "neoforge" | "quilt";
    withSodiumIris?: boolean;
    withOptifine?: boolean;
  }) => Promise<void>;
  edit?: GameInstance | null;
  installedVersions: string[];
  openInstanceFolder?: (instanceId: string) => void;
}

export function InstanceModal({
  open,
  onClose,
  onSave,
  edit,
  installedVersions,
  openInstanceFolder,
}: Props) {
  const [name, setName] = useState("");
  const [versionId, setVersionId] = useState("");
  const [icon, setIcon] = useState<InstanceIcon>("grass");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedLoader, setSelectedLoader] = useState<"vanilla" | "fabric" | "forge" | "neoforge" | "quilt">("vanilla");
  const [withSodiumIris, setWithSodiumIris] = useState(false);
  const [withOptifine, setWithOptifine] = useState(false);
  const [installProgress, setInstallProgress] = useState<{ stage: string; percent: number; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(edit?.name ?? "");
    setVersionId(edit?.versionId ?? installedVersions[0] ?? "");
    setIcon(edit?.icon ?? "grass");
    setNotes(edit?.notes ?? "");
    setSelectedLoader("vanilla");
    setWithSodiumIris(false);
    setWithOptifine(false);
    setInstallProgress(null);
  }, [open, edit, installedVersions]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !versionId) return;
    setSaving(true);
    setInstallProgress({ stage: "init", percent: 0, message: "Подготовка..." });
    
    // Listen to progress events
    const unsubscribe = (window as any).murflame?.onLaunchProgress((progress: any) => {
      setInstallProgress(progress);
    }) || (() => {});
    
    try {
      await onSave({
        name: name.trim(),
        versionId,
        icon,
        notes: notes.trim() || undefined,
        loader: selectedLoader,
        withSodiumIris: selectedLoader === "fabric" ? withSodiumIris : undefined,
        withOptifine: selectedLoader === "forge" ? withOptifine : undefined,
      });
      
      // Wait a bit to ensure progress is complete
      await new Promise(resolve => setTimeout(resolve, 500));
      onClose();
    } finally {
      unsubscribe();
      setSaving(false);
      setInstallProgress(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card instance-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="instance-modal-title"
      >
        <div className="modal-header">
          <h3 id="instance-modal-title">
            {edit ? "Изменить экземпляр" : "Новый экземпляр"}
          </h3>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="instance-modal-form">
          <div className="form-group">
            <label>Название</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Мой мир, Выживание…"
              required
            />
          </div>

          <div className="form-group">
            <label>Версия</label>
            {installedVersions.length === 0 ? (
              <p className="form-hint">
                Нет установленных версий. Установите Minecraft во вкладке «Версии».
              </p>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  className="select"
                  value={versionId}
                  onChange={(e) => setVersionId(e.target.value)}
                  required
                  style={{ flex: 1 }}
                >
                  {installedVersions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                {edit && openInstanceFolder && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => openInstanceFolder(edit.id)}
                    title="Открыть папку экземпляра"
                  >
                    <FolderOpen size={16} />
                  </button>
                )}
              </div>
              )}
            </div>

          {!edit && (
            <div className="form-group">
              <label>Мод-лоадер</label>
              <select
                className="select"
                value={selectedLoader}
                onChange={(e) => setSelectedLoader(e.target.value as any)}
                disabled={saving}
              >
                <option value="vanilla">Vanilla</option>
                <option value="fabric">Fabric</option>
                <option value="forge">Forge</option>
                <option value="neoforge">NeoForge</option>
                <option value="quilt">Quilt</option>
              </select>
            </div>
          )}

          {!edit && selectedLoader === "fabric" && (
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={withSodiumIris}
                  onChange={(e) => setWithSodiumIris(e.target.checked)}
                  disabled={saving}
                />
                <span>Установить Sodium + Iris</span>
              </label>
              <p className="form-hint">Установит моды для улучшения производительности и шейдеров</p>
            </div>
          )}

          {!edit && selectedLoader === "forge" && (
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={withOptifine}
                  onChange={(e) => setWithOptifine(e.target.checked)}
                  disabled={saving}
                />
                <span>Установить OptiFine</span>
              </label>
              <p className="form-hint">Установит мод для улучшения графики и шейдеров</p>
            </div>
          )}

          <div className="form-group">
            <label>Иконка</label>
            <div className="icon-picker">
              {ICON_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`icon-picker-item ${icon === opt.id ? "active" : ""}`}
                  onClick={() => setIcon(opt.id)}
                  title={opt.label}
                >
                  <InstanceIconView icon={opt.id} size={36} />
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Заметки (необязательно)</label>
            <textarea
              className="input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Описание, моды…"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !name.trim() || !versionId}
            >
              {saving ? "Создание…" : edit ? "Сохранить" : "Создать"}
            </button>
          </div>

          {installProgress && (
            <div className="install-progress">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Loader2 size={16} className="spin" />
                <span>{installProgress.message}</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${installProgress.percent}%` }}
                />
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
