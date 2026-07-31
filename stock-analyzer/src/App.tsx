import { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { PortfolioDetailView } from './components/PortfolioDetailView';
import { SettingsView } from './components/SettingsView';
import { usePortfolioStore } from './store/usePortfolioStore';

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const selectedPortfolioId = usePortfolioStore(state => state.selectedPortfolioId);

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'settings' ? (
            <SettingsView />
          ) : selectedPortfolioId ? (
            <PortfolioDetailView />
          ) : (
            <DashboardView />
          )}
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
          MOEX Strategy Analyzer PWA &bull; Stage 5 Complete
        </footer>
      </div>
    </ThemeProvider>
  );
}

export default App;