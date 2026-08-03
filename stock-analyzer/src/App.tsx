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
      if (!window.screen?.orientation?.lock) return;
      
      try {
        if (settings.orientation === 'portrait') {
          await screen.orientation.lock('portrait');
        } else if (settings.orientation === 'landscape') {
          await screen.orientation.lock('landscape');
        } else {
          screen.orientation.unlock();
        }
      } catch (err) {
        // Ошибка ожидаема, если не было взаимодействия с DOM или режим не Standalone
        console.warn('Orientation lock failed:', err);
      }
    };

    // 1. Пытаемся применить сразу (если это повторный рендер)
    applyOrientation();

    // 2. Вешаем слушатель на любое взаимодействие (User Gesture)
    // Это критично для Chrome на Android
    const handleUserInteraction = () => {
      applyOrientation();
      // Не удаляем слушатель, чтобы при смене настроек "на лету" блокировка тоже срабатывала
    };

    window.addEventListener('touchstart', handleUserInteraction);
    window.addEventListener('mousedown', handleUserInteraction);
    
    // 3. Обработка возврата в приложение из фонового режима
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') applyOrientation();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('mousedown', handleUserInteraction);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [settings.orientation]);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors">
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
            MOEX Strategy Analyzer PWA &bull; v1.1.4
          </footer>
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;