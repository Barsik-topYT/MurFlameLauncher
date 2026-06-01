import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

export function LauncherSplashScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const steps = [
      { p: 10, delay: 100, msg: "Загрузка ядра…" },
      { p: 30, delay: 200, msg: "Инициализация модулей…" },
      { p: 60, delay: 300, msg: "Подключение к сервисам…" },
      { p: 85, delay: 150, msg: "Подготовка интерфейса…" },
      { p: 100, delay: 200, msg: "Готово!" },
    ];

    let current = 0;

    const next = () => {
      if (current >= steps.length) {
        setFadeOut(true);
        setTimeout(onComplete, 300);
        return;
      }
      const step = steps[current];
      setProgress(step.p);
      current++;
      setTimeout(next, step.delay);
    };

    setTimeout(next, 150);
  }, [onComplete]);

  return (
    <div
      className="splash-screen"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0d0d12 0%, #1a1a2e 100%)",
        transition: "opacity 0.3s ease-out",
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? "none" : "auto",
      }}
    >
      {/* Анимированная иконка пламени */}
      <div
        className="splash-icon"
        style={{
          position: "relative",
          marginBottom: 32,
        }}
      >
        <Flame
          size={80}
          style={{
            color: "var(--accent)",
            filter: "drop-shadow(0 0 20px var(--accent-glow))",
            animation: "bounce 1.5s ease-in-out infinite, pulse 2s ease-in-out infinite",
          }}
        />
      </div>

      {/* Название лаунчера */}
      <h1
        style={{
          fontSize: 36,
          fontWeight: 800,
          letterSpacing: "0.05em",
          marginBottom: 8,
          color: "#fff",
          textShadow: "0 0 20px var(--accent-glow)",
        }}
      >
        MurFlame
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          marginBottom: 48,
        }}
      >
        Лаунчер Minecraft
      </p>

      {/* Прогресс-бар */}
      <div
        style={{
          width: 280,
          height: 6,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 999,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            height: "100%",
            background: "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 60%, white))",
            borderRadius: 999,
            width: `${progress}%`,
            transition: "width 0.3s ease-out",
            boxShadow: "0 0 10px var(--accent-glow)",
          }}
        />
      </div>

      {/* Сообщение */}
      <p
        style={{
          marginTop: 16,
          fontSize: 13,
          color: "var(--text-muted)",
          minHeight: 20,
        }}
      >
        {[
          "Загрузка ядра…",
          "Инициализация модулей…",
          "Подключение к сервисам…",
          "Подготовка интерфейса…",
          "Готово!",
        ][Math.floor((progress / 100) * 5) - (progress === 100 ? 0 : 1)] || "Загрузка…"}
      </p>

      {/* CSS анимации */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
