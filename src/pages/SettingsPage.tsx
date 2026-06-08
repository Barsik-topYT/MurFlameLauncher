import { useEffect, useState } from "react";
import { FolderOpen, Coffee, Check, X } from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import type { JavaInfo, LauncherSettings } from "../types/api";

// Расширяем Window интерфейс для TypeScript
declare global {
  interface Window {
    murflame: {
      java: {
        list: () => Promise<JavaInfo[]>;
      };
      settings: {
        pickJava: () => Promise<string>;
        pickGameDir: () => Promise<string>;
      };
    };
  }
}

export function SettingsPage() {
  const { settings, updateSettings } = useLauncherStore();
  const [javaList, setJavaList] = useState<JavaInfo[]>([]);
  
  // Временные настройки для Apply/Cancel
  const [tempSettings, setTempSettings] = useState<LauncherSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<LauncherSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!window.murflame) return;
    window.murflame.java
      .list()
      .then(setJavaList)
      .catch((e) => console.error("Java list:", e));
  }, []);

  // Загружаем настройки при открытии
  useEffect(() => {
    if (settings) {
      setTempSettings(settings);
      setOriginalSettings(settings);
    }
  }, [settings]);

  // Проверка доступности API
  if (!window.murflame) {
    return (
      <>
        <div className="page-header">
          <h2>Настройки</h2>
          <p>API лаунчера недоступен</p>
        </div>
        <div className="alert alert-error">
          Запустите через <strong>npm run dev</strong> (не открывайте сайт в браузере).
        </div>
      </>
    );
  }

  if (!tempSettings) {
    return (
      <div className="page-header">
        <h2>Настройки</h2>
        <p>Загрузка…</p>
      </div>
    );
  }

  // Применяем настройки
  const handleApply = async () => {
    if (!tempSettings) return;
    await updateSettings(tempSettings);
    setOriginalSettings({ ...tempSettings });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Отменяем изменения
  const handleCancel = () => {
    if (originalSettings) {
      setTempSettings({ ...originalSettings });
    }
  };

  // Проверяем, есть ли изменения
  const hasChanges = JSON.stringify(tempSettings) !== JSON.stringify(originalSettings);

  // Пасхалка — проверяем через правильный тип
  const isEasterEgg = (tempSettings as LauncherSettings & { easterEgg?: boolean }).easterEgg === true;

  const memMin = 512;
  const memMax = 16384;
  const step = 256;

  return (
    <>
      <div className="page-header">
        <h2>{isEasterEgg ? "БАРСФЕЙС" : "Настройки"}</h2>
        <p>Память, Java, тема интерфейса и папка игры</p>
      </div>

      {saved && (
        <div className="alert alert-success">Настройки применены!</div>
      )}

      <div className="settings-grid">
        {/* Интерфейс */}
        <div className="settings-section">
          <h3>Интерфейс</h3>
        </div>

        <div className="card">
          <div className="form-group">
            <label>Тема</label>
            <div className="theme-picker">
              {(["murflame", "dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`theme-option ${tempSettings.theme === t ? "active" : ""}`}
                  onClick={() => setTempSettings({ ...tempSettings, theme: t })}
                >
                  {t === "murflame" ? "MurFlame" : t === "dark" ? "Тёмная" : "Светлая"}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Акцентный цвет</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="color"
                className="color-input"
                value={tempSettings.accentColor}
                onChange={(e) => setTempSettings({ ...tempSettings, accentColor: e.target.value })}
              />
              <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                {tempSettings.accentColor}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label>Прозрачность фона</label>
            <div className="range-row">
              <input
                type="range"
                min={0.5}
                max={1}
                step={0.05}
                value={tempSettings.backgroundOpacity}
                onChange={(e) =>
                  setTempSettings({ ...tempSettings, backgroundOpacity: parseFloat(e.target.value) })
                }
              />
              <span className="range-value">
                {Math.round(tempSettings.backgroundOpacity * 100)}%
              </span>
            </div>
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={tempSettings.sidebarCompact}
              onChange={(e) => setTempSettings({ ...tempSettings, sidebarCompact: e.target.checked })}
            />
            <span>Компактная боковая панель</span>
          </label>
        </div>

        {/* Память */}
        <div className="settings-section">
          <h3>Память (RAM)</h3>
        </div>

        <div className="card">
          <div className="form-group">
            <label>Максимум ОЗУ (Xmx)</label>
            <div className="range-row">
              <input
                type="range"
                min={memMin}
                max={memMax}
                step={step}
                value={tempSettings.maxMemory}
                onChange={(e) =>
                  setTempSettings({ ...tempSettings, maxMemory: parseInt(e.target.value, 10) })
                }
              />
              <span className="range-value">{tempSettings.maxMemory} МБ</span>
            </div>
          </div>

          <div className="form-group">
            <label>Минимум ОЗУ (Xms)</label>
            <div className="range-row">
              <input
                type="range"
                min={256}
                max={4096}
                step={128}
                value={tempSettings.minMemory}
                onChange={(e) =>
                  setTempSettings({ ...tempSettings, minMemory: parseInt(e.target.value, 10) })
                }
              />
              <span className="range-value">{tempSettings.minMemory} МБ</span>
            </div>
          </div>

          <div className="form-group">
            <label>Доп. аргументы JVM</label>
            <input
              className="input"
              placeholder="-XX:+UseG1GC -Dfml.ignoreInvalidMinecraftCertificates=true"
              value={tempSettings.customJvmArgs}
              onChange={(e) => setTempSettings({ ...tempSettings, customJvmArgs: e.target.value })}
            />
          </div>
        </div>

        {/* Java и папки */}
        <div className="settings-section">
          <h3>Java и папки</h3>
        </div>

        <div className="card">
          <div className="form-group">
            <label>Путь к Java</label>
            <div className="input-row">
              <select
                className="select"
                value={tempSettings.javaPath}
                onChange={(e) => setTempSettings({ ...tempSettings, javaPath: e.target.value })}
              >
                <option value="">Авто (java из PATH)</option>
                {javaList.map((j) => (
                  <option key={j.path} value={j.path}>
                    {j.version} — {j.path}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  const p = await window.murflame?.settings.pickJava();
                  if (p) setTempSettings({ ...tempSettings, javaPath: p });
                }}
              >
                <Coffee size={16} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Папка игры (.minecraft)</label>
            <div className="input-row">
              <input className="input" value={tempSettings.gameDir} readOnly />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  const p = await window.murflame?.settings.pickGameDir();
                  if (p) setTempSettings({ ...tempSettings, gameDir: p });
                }}
              >
                <FolderOpen size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Поведение */}
        <div className="settings-section">
          <h3>Поведение</h3>
        </div>

        <div className="card">
          <label className="toggle" style={{ marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={tempSettings.closeOnLaunch}
              onChange={(e) => setTempSettings({ ...tempSettings, closeOnLaunch: e.target.checked })}
            />
            <span>Сворачивать лаунчер при запуске игры</span>
          </label>

          <label className="toggle" style={{ marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={tempSettings.closeToTray}
              onChange={(e) => setTempSettings({ ...tempSettings, closeToTray: e.target.checked })}
            />
            <span>Сворачивать в трей при закрытии</span>
          </label>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label>Какие версии показывать в списке</label>
            <select
              className="select"
              value={tempSettings.versionFilter ?? "all"}
              onChange={(e) =>
                setTempSettings({
                  ...tempSettings,
                  versionFilter: e.target.value as typeof tempSettings.versionFilter,
                })
              }
            >
              <option value="all">Все (релизы, снапшоты, alpha, beta)</option>
              <option value="release">Только релизы</option>
              <option value="snapshot">Только снапшоты</option>
              <option value="old_beta">Только Beta</option>
              <option value="old_alpha">Только Alpha</option>
            </select>
          </div>
        </div>

        {/* Кнопки Apply/Cancel */}
        <div className="settings-actions" style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={!hasChanges}
          >
            <X size={16} />
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleApply}
            disabled={!hasChanges}
          >
            <Check size={16} />
            Применить
          </button>
        </div>

        <div style={{ marginTop: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          <p>Версия приложения 08.06.26</p>
          <p>Создатели: Barsik_topYT, K0maruTrende</p>
        </div>
      </div>
    </>
  );
}