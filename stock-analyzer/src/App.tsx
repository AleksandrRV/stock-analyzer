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
      if (!screen.orientation || !('lock' in screen.orientation)) return;
      
      try {
        if (settings.orientation === 'portrait') {
          await (screen.orientation as any).lock('portrait');
        } else if (settings.orientation === 'landscape') {
          await (screen.orientation as any).lock('landscape');
        } else if (settings.orientation === 'auto') {
          screen.orientation.unlock();
        }
      } catch (err) {
        // Ошибка часто возникает если приложение не в полноэкранном режиме (PWA)
        console.warn('Failed to lock orientation:', err);
      }
    };

    // 1. Попытка немедленной фиксации (сработает если уже был жест)
    applyOrientation();

    // 2. Фиксация при первом же касании (требование браузеров для безопасности)
    const handleGesture = () => {
      applyOrientation();
      window.removeEventListener('touchstart', handleGesture);
      window.removeEventListener('mousedown', handleGesture);
    };
    window.addEventListener('touchstart', handleGesture);
    window.addEventListener('mousedown', handleGesture);

    // 3. Повторная фиксация при возврате в приложение (resume)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        applyOrientation();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('touchstart', handleGesture);
      window.removeEventListener('mousedown', handleGesture);
      document.removeEventListener('visibilitychange', handleVisibility);
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
            MOEX Strategy Analyzer PWA &bull; v1.1.3
          </footer>
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
