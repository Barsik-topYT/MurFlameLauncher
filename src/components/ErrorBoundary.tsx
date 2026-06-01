import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("MurFlame UI error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            color: "#f0f0f5",
            background: "#0d0d12",
            height: "100vh",
            fontFamily: "Segoe UI, sans-serif",
          }}
        >
          <h2 style={{ color: "#ff6b35", marginBottom: 12 }}>Ошибка интерфейса</h2>
          <pre style={{ color: "#9898a8", whiteSpace: "pre-wrap", fontSize: 13 }}>
            {this.state.error.message}
          </pre>
          <button
            type="button"
            style={{
              marginTop: 16,
              padding: "10px 20px",
              background: "#ff6b35",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              cursor: "pointer",
            }}
            onClick={() => this.setState({ error: null })}
          >
            Повторить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
