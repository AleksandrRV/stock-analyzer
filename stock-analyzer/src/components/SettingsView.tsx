import React, { useState, useEffect, useRef } from 'react';
import { usePortfolioStore } from '../store/usePortfolioStore';
import { marketDb } from '../db/marketDb';
import { FilePortabilityService } from '../services/storage/filePortability';
import { DEFAULT_TICKER_RENAMES } from '../engine/TickerResolver';
import { IExportData } from '../types/domain';
import { ManualDividendsModal } from './modals/ManualDividendsModal'; // Импорт модалки

import { 
  Sliders, 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  Plus, 
  Check, 
  AlertCircle, 
  RefreshCw,
  HardDrive,
  Coins
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    groups, 
    portfolios, 
    updateSettings, 
    addCustomTickerRename, 
    removeCustomTickerRename,
    restoreFullData 
  } = usePortfolioStore();

  const [cacheStats, setCacheStats] = useState({ pricesCount: 0, dividendsCount: 0 });
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Модалка ручных дивидендов
  const [isManualDivsOpen, setIsManualDivsOpen] = useState(false);

  const [oldTicker, setOldTicker] = useState('');
  const [newTicker, setNewTicker] = useState('');
  const [changeDate, setChangeDate] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStats = async () => {
    const stats = await marketDb.getCacheStats();
    setCacheStats(stats);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleExport = async () => {
    const exportPayload: IExportData = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings,
      groups,
      portfolios,
    };

    const success = await FilePortabilityService.exportData(exportPayload);
    if (success) {
      showToast('success', 'Файл резервной копии сохранен!');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const importedData = FilePortabilityService.parseImportFile(content);
        
        if (window.confirm(`Вы уверены, что хотите восстановить данные? Текущие портфели будут заменены (Портфелей в файле: ${importedData.portfolios.length} шт.)`)) {
          restoreFullData(importedData);
          showToast('success', 'Данные успешно восстановлены из файла!');
        }
      } catch (err: any) {
        showToast('error', `Ошибка импорта: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldTicker || !newTicker || !changeDate) return;

    addCustomTickerRename({
      oldTicker: oldTicker.trim().toUpperCase(),
      newTicker: newTicker.trim().toUpperCase(),
      changeDate: `${changeDate}T00:00:00.000Z`,
    });

    setOldTicker('');
    setNewTicker('');
    setChangeDate('');
    showToast('success', 'Правило переименования тикера добавлено');
  };

  const handleClearCache = async (type: 'STOCKS' | 'FUNDS' | 'INDICES' | 'DIVIDENDS' | 'ALL') => {
    if (!window.confirm('Очистить выбранный рыночный кэш? (Ваши портфели останутся в сохранности)')) return;

    switch (type) {
      case 'STOCKS':
        await marketDb.clearStockPricesOnly();
        break;
      case 'FUNDS':
        await marketDb.clearFundPricesOnly();
        break;
      case 'INDICES':
        await marketDb.clearIndicesOnly();
        break;
      case 'DIVIDENDS':
        await marketDb.clearDividendsOnly();
        break;
      case 'ALL':
        await marketDb.clearAllCache();
        break;
    }

    await loadStats();
    showToast('success', 'Выбранный кэш очищен. При просмотре портфелей котировки скачаются заново.');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {notification && (
        <div className={`p-4 rounded-xl border text-sm font-medium flex items-center gap-2 animate-in fade-in ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
        }`}>
          {notification.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* 1. РУЧНОЙ ВВОД ДИВИДЕНДОВ */}
      <div className="p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Ручной ввод дивидендов</h3>
              <p className="text-xs text-slate-400">Добавьте дивиденды вручную, если Мосбиржа задерживает их публикацию</p>
            </div>
          </div>

          <button
            onClick={() => setIsManualDivsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs rounded-xl shadow-sm transition-all"
          >
            <Coins className="w-4 h-4" />
            <span>Управление дивидендами</span>
          </button>
        </div>
      </div>

      {/* 2. ИМПОРТ И ЭКСПОРТ JSON */}
      <div className="p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Импорт и Экспорт данных (Бэкап)</h3>
            <p className="text-xs text-slate-400">Сохраняйте стратегии в файл JSON для передачи между устройствами</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 p-4 bg-sky-500 hover:bg-sky-600 text-white font-medium text-sm rounded-xl shadow-sm transition-all"
          >
            <Download className="w-5 h-5" />
            <span>Скачать бэкап (.json)</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 p-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium text-sm rounded-xl transition-all border border-slate-200 dark:border-slate-600"
          >
            <Upload className="w-5 h-5 text-indigo-500" />
            <span>Загрузить из файла (.json)</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      {/* 3. ГЛОБАЛЬНЫЕ НАСТРОЙКИ */}
      <div className="p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-6 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div className="p-2 bg-sky-500/10 text-sky-500 rounded-xl">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Глобальные настройки расчетов</h3>
            <p className="text-xs text-slate-400">Правила, применяемые ко всем портфелям</p>
          </div>
        </div>

        <div className="space-y-2 max-w-xs">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
            Ставка налога на дивиденды (%):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="1"
              min="0"
              max="100"
              value={settings.dividendTaxRate}
              onChange={e => updateSettings({ dividendTaxRate: parseFloat(e.target.value) || 0 })}
              className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold w-28"
            />
            <span className="text-xs text-slate-400">% (по умолчанию 15%)</span>
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-sm">Машина времени тикеров (Corporate Actions)</h4>
              <p className="text-xs text-slate-400">Правила переименования акций на Мосбирже</p>
            </div>
          </div>

          <form onSubmit={handleAddRename} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              required
              placeholder="Старый (TCSG)"
              value={oldTicker}
              onChange={e => setOldTicker(e.target.value.toUpperCase())}
              className="p-2 bg-white dark:bg-slate-800 border rounded-lg text-xs font-mono uppercase"
            />
            <input
              type="text"
              required
              placeholder="Новый (T)"
              value={newTicker}
              onChange={e => setNewTicker(e.target.value.toUpperCase())}
              className="p-2 bg-white dark:bg-slate-800 border rounded-lg text-xs font-mono uppercase"
            />
            <input
              type="date"
              required
              value={changeDate}
              onChange={e => setChangeDate(e.target.value)}
              className="p-2 bg-white dark:bg-slate-800 border rounded-lg text-xs font-mono"
            />
            <button
              type="submit"
              className="p-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1 hover:bg-slate-700"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить</span>
            </button>
          </form>

          <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs font-mono pr-1">
            {(settings.tickerRenames || []).map(rule => (
              <div key={rule.oldTicker} className="flex items-center justify-between p-2 bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <span>{rule.oldTicker} $\rightarrow$ {rule.newTicker} (с {rule.changeDate.split('T')[0]})</span>
                <button onClick={() => removeCustomTickerRename(rule.oldTicker)} className="text-rose-500 hover:text-rose-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {DEFAULT_TICKER_RENAMES.map(rule => (
              <div key={rule.oldTicker} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500">
                <span>{rule.oldTicker} $\rightarrow$ {rule.newTicker} (с {rule.changeDate.split('T')[0]})</span>
                <span className="text-[10px] text-slate-400 italic">Системное</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. РЫНОЧНЫЙ КЭШ */}
      <div className="p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Рыночный кэш (IndexedDB)</h3>
              <p className="text-xs text-slate-400">Сохраненные котировки и дивиденды Мосбиржи</p>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-500">
            Цен: <strong className="text-sky-500">{cacheStats.pricesCount}</strong> | Дивидендов: <strong className="text-emerald-500">{cacheStats.dividendsCount}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
          <button
            onClick={() => handleClearCache('STOCKS')}
            className="p-2.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-rose-500/10 hover:text-rose-500 text-xs font-medium rounded-xl text-left border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-between"
          >
            <span>Цены акций</span>
            <RefreshCw className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => handleClearCache('FUNDS')}
            className="p-2.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-rose-500/10 hover:text-rose-500 text-xs font-medium rounded-xl text-left border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-between"
          >
            <span>Цены фондов (LQDT)</span>
            <RefreshCw className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => handleClearCache('INDICES')}
            className="p-2.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-rose-500/10 hover:text-rose-500 text-xs font-medium rounded-xl text-left border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-between"
          >
            <span>Значения MCFTR</span>
            <RefreshCw className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => handleClearCache('DIVIDENDS')}
            className="p-2.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-rose-500/10 hover:text-rose-500 text-xs font-medium rounded-xl text-left border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-between"
          >
            <span>История дивидендов</span>
            <RefreshCw className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => handleClearCache('ALL')}
            className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white text-xs font-bold rounded-xl text-left border border-rose-500/20 transition-all flex items-center justify-between col-span-1 sm:col-span-2 lg:col-span-1"
          >
            <span>Очистить весь кэш</span>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* МОДАЛКА РУЧНЫХ ДИВИДЕНДОВ */}
      <ManualDividendsModal
        isOpen={isManualDivsOpen}
        onClose={() => setIsManualDivsOpen(false)}
      />

    </div>
  );
};