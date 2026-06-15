import { useEffect, useState } from "react";
import { FolderOpen, Coffee, Check, X } from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import type { JavaInfo, LauncherSettings } from "../types/api";
import { useLocale } from "../hooks/useLocale";

export function SettingsPage() {
  const { settings, updateSettings } = useLauncherStore();
  const { t } = useLocale();
  const [javaVersions, setJavaVersions] = useState<JavaInfo[]>([]);
  const [tempSettings, setTempSettings] = useState<LauncherSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setTempSettings({ ...settings });
      setHasChanges(false);
    }
  }, [settings]);

  useEffect(() => {
    if (window.murflame?.java.list) {
      window.murflame.java.list().then(setJavaVersions);
    }
  }, []);

  const handleApply = async () => {
    if (tempSettings) {
      await updateSettings(tempSettings);
      setHasChanges(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleCancel = () => {
    if (settings) {
      setTempSettings({ ...settings });
      setHasChanges(false);
    }
  };

  const handleTempChange = (key: keyof LauncherSettings, value: any) => {
    if (tempSettings) {
      setTempSettings({ ...tempSettings, [key]: value });
      setHasChanges(true);
    }
  };

  if (!tempSettings) return null;

  return (
    <>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>{t("settings.title")}</h2>
          <p>Настройка памяти, Java, темы и папки игры</p>
        </div>
        <div className="settings-actions" style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={!hasChanges}
          >
            <X size={16} />
            {t("settings.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleApply}
            disabled={!hasChanges}
          >
            <Check size={16} />
            {t("settings.apply")}
          </button>
        </div>
      </div>

      {saved && (
        <div className="alert alert-success">Настройки применены!</div>
      )}

      <div className="settings-grid">
        {/* Language & UI Mode */}
        <div className="settings-section">
          <h3>{t("settings.language")}</h3>
        </div>
        <div className="card">
          <div className="form-group">
            <label>{t("settings.language")}</label>
            <select
              className="select"
              value={tempSettings.language || "ru"}
              onChange={(e) => handleTempChange("language", e.target.value as "ru" | "en")}
            >
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div className="settings-section">
          <h3>{t("settings.uiMode")}</h3>
        </div>
        <div className="card">
          <div className="form-group">
            <label>{t("settings.uiMode")}</label>
            <select
              className="select"
              value={tempSettings.uiMode ?? "default"}
              onChange={(e) => handleTempChange("uiMode", e.target.value as "default" | "simplified")}
            >
              <option value="default">{t("settings.uiDefault")}</option>
              <option value="simplified">{t("settings.uiSimplified")}</option>
            </select>
          </div>
        </div>

        {/* Interface */}
        <div className="settings-section">
          <h3>{t("settings.theme")}</h3>
        </div>
        <div className="card">
          <div className="form-group">
            <label>{t("settings.theme")}</label>
            <div className="select-group">
              <select
                className="select"
                value={tempSettings.theme}
                onChange={(e) => handleTempChange("theme", e.target.value as "dark" | "light" | "murflame")}
              >
                <option value="dark">Тёмная / Dark</option>
                <option value="light">Светлая / Light</option>
                <option value="murflame">MurFlame (фирменная)</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>{t("settings.accentColor")}</label>
            <div className="color-input-group">
              <input
                type="color"
                value={tempSettings.accentColor}
                onChange={(e) => handleTempChange("accentColor", e.target.value)}
              />
              <input
                type="text"
                value={tempSettings.accentColor}
                onChange={(e) => handleTempChange("accentColor", e.target.value)}
                placeholder="#ff5e2e"
              />
            </div>
          </div>
          <div className="form-group">
            <label>{t("settings.backgroundOpacity")}</label>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.01"
              value={tempSettings.backgroundOpacity}
              onChange={(e) => handleTempChange("backgroundOpacity", parseFloat(e.target.value))}
            />
            <span>{Math.round(tempSettings.backgroundOpacity * 100)}%</span>
          </div>
          <div className="form-group">
            <label className="toggle">
              <input
                type="checkbox"
                checked={tempSettings.sidebarCompact}
                onChange={(e) => handleTempChange("sidebarCompact", e.target.checked)}
              />
              <span>{t("settings.sidebarCompact")}</span>
            </label>
          </div>
        </div>

        {/* Memory */}
        <div className="settings-section">
          <h3>{t("settings.memory")}</h3>
        </div>
        <div className="card">
          <div className="form-group">
            <label>{t("settings.maxMemory")}</label>
            <div className="range-input">
              <input
                type="range"
                min="512"
                max="32768"
                step="512"
                value={tempSettings.maxMemory}
                onChange={(e) => handleTempChange("maxMemory", parseInt(e.target.value))}
              />
              <span>{tempSettings.maxMemory} MB</span>
            </div>
          </div>
          <div className="form-group">
            <label>{t("settings.minMemory")}</label>
            <div className="range-input">
              <input
                type="range"
                min="256"
                max="8192"
                step="256"
                value={tempSettings.minMemory}
                onChange={(e) => handleTempChange("minMemory", parseInt(e.target.value))}
              />
              <span>{tempSettings.minMemory} MB</span>
            </div>
          </div>
          <div className="form-group">
            <label>{t("settings.customJvmArgs")}</label>
            <input
              type="text"
              className="input"
              value={tempSettings.customJvmArgs}
              onChange={(e) => handleTempChange("customJvmArgs", e.target.value)}
              placeholder="-XX:+UseG1GC -Dsun.rmi.dgc.server.gcInterval=2147483646"
            />
          </div>
        </div>

        {/* Java & Folders */}
        <div className="settings-section">
          <h3>{t("settings.javaAndFolder")}</h3>
        </div>
        <div className="card">
          <div className="form-group">
            <label>{t("settings.javaPath")}</label>
            <div className="path-input">
              <input
                type="text"
                className="input"
                value={tempSettings.javaPath}
                onChange={(e) => handleTempChange("javaPath", e.target.value)}
                placeholder="C:\Program Files\Java\jre1.8.0_361\bin\javaw.exe"
              />
              <button className="btn btn-secondary" onClick={async () => {
                const path = await window.murflame.settings.pickJava();
                if (path) handleTempChange("javaPath", path);
              }}>
                <FolderOpen size={16} />
              </button>
            </div>
            {javaVersions.length > 0 && (
              <select
                className="select"
                style={{ marginTop: 8 }}
                onChange={(e) => handleTempChange("javaPath", e.target.value)}
                value=""
              >
                <option value="">— Найденные Java —</option>
                {javaVersions.map((java) => (
                  <option key={java.path} value={java.path}>
                    {java.version} — {java.path}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="form-group">
            <label>{t("settings.gameFolder")}</label>
            <div className="path-input">
              <input
                type="text"
                className="input"
                value={tempSettings.gameDir}
                onChange={(e) => handleTempChange("gameDir", e.target.value)}
              />
              <button className="btn btn-secondary" onClick={async () => {
                const path = await window.murflame.settings.pickGameDir();
                if (path) handleTempChange("gameDir", path);
              }}>
                <FolderOpen size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Behavior */}
        <div className="settings-section">
          <h3>{t("settings.behavior")}</h3>
        </div>
        <div className="card">
          <div className="form-group">
            <label className="toggle">
              <input
                type="checkbox"
                checked={tempSettings.closeOnLaunch}
                onChange={(e) => handleTempChange("closeOnLaunch", e.target.checked)}
              />
              <span>{t("settings.closeOnLaunch")}</span>
            </label>
          </div>
          <div className="form-group">
            <label className="toggle">
              <input
                type="checkbox"
                checked={tempSettings.closeToTray}
                onChange={(e) => handleTempChange("closeToTray", e.target.checked)}
              />
              <span>{t("settings.closeToTray")}</span>
            </label>
          </div>
          <div className="form-group">
            <label>{t("settings.versionFilter")}</label>
            <select
              className="select"
              value={tempSettings.versionFilter}
              onChange={(e) => handleTempChange("versionFilter", e.target.value as any)}
            >
              <option value="all">Все версии</option>
              <option value="release">Только релизы</option>
              <option value="snapshot">Снапшоты</option>
              <option value="old_beta">Beta</option>
              <option value="old_alpha">Alpha</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          <p>
            <Coffee size={14} style={{ display: "inline", marginRight: 4 }} />
            Версия приложения 15.06.26
          </p>
          <p>Создатели: Barsik_topYT, K0maruTrende</p>
        </div>
      </div>
    </>
  );
}