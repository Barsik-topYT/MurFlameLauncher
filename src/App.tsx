import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { HomePage } from "./pages/HomePage";
import { AccountsPage } from "./pages/AccountsPage";
import { VersionsPage } from "./pages/VersionsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SkinsPage } from "./pages/SkinsPage";
import { ModsPage } from "./pages/ModsPage";
import { LauncherSplashScreen } from "./components/LauncherSplashScreen";
import { useLauncherStore } from "./store/useLauncherStore";

// Компонент-заглушка для ленивой загрузки
const PageSkeleton = () => (
  <div className="page-skeleton">
    <div className="skeleton-loader"></div>
  </div>
);

// Кэш для страниц
const pageCache = new Map();

export default function App() {
  const page = useLauncherStore((s) => s.page);
  const loadAll = useLauncherStore((s) => s.loadAll);
  const setProgress = useLauncherStore((s) => s.setProgress);
  const [showSplash, setShowSplash] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Оптимизированная загрузка с кэшированием
  const handleLoadAll = useCallback(async () => {
    if (pageCache.has('loaded')) {
      setIsLoading(false);
      return;
    }
    
    try {
      await loadAll();
      pageCache.set('loaded', true);
    } catch (error) {
      console.error("Ошибка загрузки:", error);
    } finally {
      setIsLoading(false);
    }
  }, [loadAll]);

  useEffect(() => {
    if (!window.murflame) {
      console.error(
        "MurFlame API недоступен. Запускайте через: npm run electron:dev"
      );
      return;
    }
    
    handleLoadAll();
    
    const unsub = window.murflame.onLaunchProgress((progress) => {
      setProgress(progress);
      // Скрываем сплеш при завершении загрузки
      if (progress.stage === "running" || progress.percent === 100) {
        setTimeout(() => setShowSplash(false), 500);
      }
    });
    
    return () => {
      unsub?.();
      pageCache.clear();
    };
  }, [handleLoadAll, setProgress]);

  // Мемоизация рендера страницы
  const renderPage = useCallback(() => {
    // Кэширование страниц
    if (pageCache.has(page)) {
      return pageCache.get(page);
    }
    
    let component;
    switch (page) {
      case "home":
        component = <HomePage />;
        break;
      case "accounts":
        component = <AccountsPage />;
        break;
      case "skins":
        component = <SkinsPage />;
        break;
      case "versions":
        component = <VersionsPage />;
        break;
      case "settings":
        component = <SettingsPage />;
        break;
      case "mods":
        component = <ModsPage />;
        break;
      default:
        component = <HomePage />;
    }
    
    pageCache.set(page, component);
    return component;
  }, [page]);

  // Показываем скелетон при загрузке
  if (isLoading && showSplash) {
    return <LauncherSplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <>
      {showSplash && (
        <LauncherSplashScreen 
          onComplete={() => setShowSplash(false)} 
          minDisplayTime={1500} // Минимальное время отображения
        />
      )}
      <div
        className="app-shell"
        style={{
          opacity: showSplash ? 0 : 1,
          transition: "opacity 0.3s ease-out",
          visibility: showSplash ? "hidden" : "visible",
        }}
      >
        <TitleBar />
        <div className="app-body">
          <Sidebar />
          <main className="main-content">
            <Suspense fallback={<PageSkeleton />}>
              {renderPage()}
            </Suspense>
          </main>
        </div>
      </div>
    </>
  );
}