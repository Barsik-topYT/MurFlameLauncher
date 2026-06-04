import { useEffect, useState } from "react";
import { FolderOpen, Coffee } from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import type { JavaInfo } from "../types/api";

export function SettingsPage() {
  const { settings, updateSettings } = useLauncherStore();
  const [javaList, setJavaList] = useState<JavaInfo[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!window.murflame) return;
    window.murflame.java
      .list()
      .then(setJavaList)
      .catch((e) => console.error("Java list:", e));
  }, []);

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

  if (!settings) {
    return (
      <div className="page-header">
        <h2>Настройки</h2>
        <p>Загрузка…</p>
      </div>
    );
  }

  const save = async (partial: Parameters<typeof updateSettings>[0]) => {
    await updateSettings(partial);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const memMin = 512;
  const memMax = 16384;
  const step = 256;

  return (
    <>
      <div className="page-header">
        <h2>Настройки</h2>
        <p>Память, Java, тема интерфейса и папка игры</p>
      </div>

      {saved && (
        <div className="alert alert-success">Настройки сохранены</div>
      )}

      <div className="settings-grid">
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
                  className={`theme-option ${settings.theme === t ? "active" : ""}`}
                  onClick={() => save({ theme: t })}
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
                value={settings.accentColor}
                onChange={(e) => save({ accentColor: e.target.value })}
              />
              <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                {settings.accentColor}
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
                value={settings.backgroundOpacity}
                onChange={(e) =>
                  save({ backgroundOpacity: parseFloat(e.target.value) })
                }
              />
              <span className="range-value">
                {Math.round(settings.backgroundOpacity * 100)}%
              </span>
            </div>
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.sidebarCompact}
              onChange={(e) => save({ sidebarCompact: e.target.checked })}
            />
            <span>Компактная боковая панель</span>
          </label>
        </div>

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
                value={settings.maxMemory}
                onChange={(e) =>
                  save({ maxMemory: parseInt(e.target.value, 10) })
                }
              />
              <span className="range-value">{settings.maxMemory} МБ</span>
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
                value={settings.minMemory}
                onChange={(e) =>
                  save({ minMemory: parseInt(e.target.value, 10) })
                }
              />
              <span className="range-value">{settings.minMemory} МБ</span>
            </div>
          </div>

          <div className="form-group">
            <label>Доп. аргументы JVM</label>
            <input
              className="input"
              placeholder="-XX:+UseG1GC -Dfml.ignoreInvalidMinecraftCertificates=true"
              value={settings.customJvmArgs}
              onChange={(e) => save({ customJvmArgs: e.target.value })}
            />
          </div>
        </div>

        <div className="settings-section">
          <h3>Java и папки</h3>
        </div>

        <div className="card">
          <div className="form-group">
            <label>Путь к Java</label>
            <div className="input-row">
              <select
                className="select"
                value={settings.javaPath}
                onChange={(e) => save({ javaPath: e.target.value })}
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
                  if (p) save({ javaPath: p });
                }}
              >
                <Coffee size={16} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
              Minecraft 1.16.5 и Forge требуют <strong>Java 8</strong> (javaw.exe). Java 17/21 для
              них не подходит — установите{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.murflame?.shell.open(
                    "https://adoptium.net/temurin/releases/?version=8"
                  );
                }}
              >
                Eclipse Temurin 8
              </a>{" "}
              и выберите здесь.
            </p>
          </div>

          <div className="form-group">
            <label>Папка игры (.minecraft)</label>
            <div className="input-row">
              <input className="input" value={settings.gameDir} readOnly />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  const p = await window.murflame?.settings.pickGameDir();
                  if (p) save({ gameDir: p });
                }}
              >
                <FolderOpen size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>Поведение</h3>
        </div>

        <div className="card">
          <label className="toggle" style={{ marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={settings.closeOnLaunch}
              onChange={(e) => save({ closeOnLaunch: e.target.checked })}
            />
            <span>Сворачивать лаунчер при запуске игры</span>
          </label>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label>Какие версии показывать в списке</label>
            <select
              className="select"
              value={settings.versionFilter ?? "all"}
              onChange={(e) =>
                save({
                  versionFilter: e.target
                    .value as typeof settings.versionFilter,
                }).then(() => useLauncherStore.getState().loadVersions())
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

        <div style={{ marginTop: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          <p>Версия приложения 04.06.26</p>
          <p>Создатели: Barsik_topYT, K0maruTrende</p>
        </div>
      </div>
    </>
  );
}
