import { Minus, Square, X, Flame } from "lucide-react";

export function TitleBar() {
  return (
    <div className="titlebar">
      <div className="titlebar-logo">
        <Flame size={18} className="flame" />
        <span>
          Mur<span className="flame">Flame</span> Launcher
        </span>
      </div>
      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-btn"
          onClick={() => window.murflame?.window.minimize()}
          aria-label="Свернуть"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          className="titlebar-btn"
          onClick={() => window.murflame?.window.maximize()}
          aria-label="Развернуть"
        >
          <Square size={14} />
        </button>
        <button
          type="button"
          className="titlebar-btn close"
          onClick={() => window.murflame?.window.close()}
          aria-label="Закрыть"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
