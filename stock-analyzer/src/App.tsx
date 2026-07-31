import { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'dashboard' ? <DashboardView /> : <SettingsView />}
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
          MOEX Strategy Analyzer PWA &bull; Stage 1 Complete
        </footer>
      </div>
    </ThemeProvider>
  );
}

export default App;