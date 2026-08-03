import { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { PortfolioDetailView } from './components/PortfolioDetailView';
import { SettingsView } from './components/SettingsView';
import { usePortfolioStore } from './store/usePortfolioStore';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PwaInstallPrompt } from './components/common/PwaInstallPrompt';

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const { selectedPortfolioId, loadFromStorage, settings } = usePortfolioStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Глобальное управление ориентацией экрана
  useEffect(() => {
    const applyOrientation = async () => {
      const orientation = window.screen?.orientation as any;
      if (!orientation || !orientation.lock) return;
      
      try {
        if (settings.orientation === 'portrait') {
          await orientation.lock('portrait');
        } else if (settings.orientation === 'landscape') {
          await orientation.lock('landscape');
        } else if (settings.orientation === 'auto') {
          orientation.unlock();
        }
      } catch (err) {
        // Ошибка ожидаема, если не было взаимодействия с DOM или режим не Standalone
        console.warn('Orientation lock failed:', err);
      }
    };

    // 1. Попытка немедленного применения
    applyOrientation();

    // 2. Слушатели для "оживления" блокировки при взаимодействии (нужно для Chrome Android)
    const handleGesture = () => {
      applyOrientation();
    };

    window.addEventListener('touchstart', handleGesture);
    window.addEventListener('mousedown', handleGesture);
    
    // 3. Обработка возврата в приложение (Resume)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') applyOrientation();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('touchstart', handleGesture);
      window.removeEventListener('mousedown', handleGesture);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [settings.orientation]);

  const orientationLockClass =
    settings.orientation === 'portrait'
      ? 'force-portrait-mode'
      : settings.orientation === 'landscape'
      ? 'force-landscape-mode'
      : '';

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <div className={`min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors ${orientationLockClass}`}>
          <Header activeTab={activeTab} setActiveTab={setActiveTab} />
          
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <PwaInstallPrompt />

            {activeTab === 'settings' ? (
              <SettingsView />
            ) : selectedPortfolioId ? (
              <PortfolioDetailView />
            ) : (
              <DashboardView />
            )}
          </main>

          <footer className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
            MOEX Strategy Analyzer PWA &bull; v1.1.5
          </footer>
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;