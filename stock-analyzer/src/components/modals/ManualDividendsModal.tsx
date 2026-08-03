import React, { useState, useEffect } from 'react';
import { IDividendHistory } from '../../types/domain';
import { marketDb } from '../../db/marketDb';
import { usePortfolioStore } from '../../store/usePortfolioStore';
import { POPULAR_MOEX_ASSETS } from '../../constants/defaultStocks';
import { SmartLabGateway } from '../../services/api/SmartLabGateway';
import { Coins, Plus, Trash2, Edit3, AlertTriangle, Check, X, Globe, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualDividendsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { loadFromStorage, clearCalculationCache } = usePortfolioStore();

  const [manualList, setManualList] = useState<IDividendHistory[]>([]);
  const [ticker, setTicker] = useState('');
  const [date, setDate] = useState('');
  const [value, setValue] = useState('');
  
  const [editingKey, setEditingKey] = useState<[string, string] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSmartLabLoading, setIsSmartLabLoading] = useState(false);

  const loadManualList = async () => {
    const list = await marketDb.getAllManualDividends();
    setManualList(list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  useEffect(() => {
    if (isOpen) {
      loadManualList();
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanTicker = ticker.trim().toUpperCase();
    const numValue = parseFloat(value);

    if (!cleanTicker || !date || isNaN(numValue) || numValue <= 0) {
      setErrorMessage('Укажите корректный тикер, дату отсечки и размер дивиденда (> 0)');
      return;
    }

    if (!editingKey) {
      const isBlocked = await marketDb.hasDividendInWindow(cleanTicker, date, 30);
      if (isBlocked) {
        setErrorMessage(`Запрещено: по акции ${cleanTicker} уже есть дивиденд за период ${date} (±30 дней)`);
        return;
      }
    }

    await marketDb.dividends.put({
      ticker: cleanTicker,
      date,
      value: numValue,
      isManual: true,
    });

    if (editingKey) {
      setSuccessMessage('Запись дивиденда успешно изменена');
    } else {
      setSuccessMessage('Ручной дивиденд успешно добавлен');
    }

    setTicker('');
    setDate('');
    setValue('');
    setEditingKey(null);
    await loadManualList();
    
    clearCalculationCache();
    loadFromStorage();
  };

  const handleFetchSmartLab = async () => {
    setIsSmartLabLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const currentYear = new Date().getFullYear();
    const prevYear = currentYear - 1;

    try {
      const [divsCurrent, divsPrev] = await Promise.all([
        SmartLabGateway.fetchSmartLabDividends(currentYear),
        SmartLabGateway.fetchSmartLabDividends(prevYear),
      ]);

      const allSmartLab = [...divsCurrent, ...divsPrev];

      if (allSmartLab.length === 0) {
        setErrorMessage('Не удалось загрузить данные со Smart-Lab');
        setIsSmartLabLoading(false);
        return;
      }

      const res = await marketDb.processSmartLabDividends(allSmartLab);

      setSuccessMessage(`Smart-Lab (${prevYear}-${currentYear}): Добавлено: ${res.added}, Обновлено: ${res.updated}, Пропущено (есть в MOEX): ${res.skipped}`);
      await loadManualList();
      clearCalculationCache();
      loadFromStorage();
    } catch (err: any) {
      setErrorMessage(`Ошибка загрузки со Smart-Lab: ${err.message}`);
    } finally {
      setIsSmartLabLoading(false);
    }
  };

  const handleEdit = (div: IDividendHistory) => {
    setEditingKey([div.ticker, div.date]);
    setTicker(div.ticker);
    setDate(div.date);
    setValue(String(div.value));
    setErrorMessage(null);
  };

  const handleDelete = async (tickerToDelete: string, dateToDelete: string) => {
    if (window.confirm(`Удалить ручную запись дивиденда по ${tickerToDelete} за ${dateToDelete}?`)) {
      await marketDb.dividends.delete([tickerToDelete, dateToDelete]);
      await loadManualList();
      clearCalculationCache();
      loadFromStorage();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] flex flex-col">
        
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Ручной ввод дивидендов</h3>
              <p className="text-xs text-slate-400">Укажите дивиденды, если они еще не появились в API Мосбиржи</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* КНОПКА ЗАГРУЗКИ СО SMART-LAB */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Globe className="w-4 h-4 text-sky-500" />
            <span>Импорт дивидендов со Smart-Lab</span>
          </div>
          <button
            type="button"
            onClick={handleFetchSmartLab}
            disabled={isSmartLabLoading}
            className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
          >
            {isSmartLabLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Загрузка...</span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5" />
                <span>Загрузить данные со Smart-Lab</span>
              </>
            )}
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-xl text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-medium flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleAddOrUpdate} className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Тикер акции:</label>
              <input
                type="text"
                required
                disabled={!!editingKey}
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                placeholder="SBER"
                className="w-full p-2 bg-white dark:bg-slate-800 border rounded-lg text-xs font-mono uppercase disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Дата отсечки:</label>
              <input
                type="date"
                required
                disabled={!!editingKey}
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full p-2 bg-white dark:bg-slate-800 border rounded-lg text-xs font-mono disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Дивиденд (₽ на акцию):</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="33.3"
                className="w-full p-2 bg-white dark:bg-slate-800 border rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[11px] text-slate-400">Быстро:</span>
            {POPULAR_MOEX_ASSETS.filter(a => a.type === 'STOCK').slice(0, 6).map(pop => (
              <button
                key={pop.ticker}
                type="button"
                disabled={!!editingKey}
                onClick={() => setTicker(pop.ticker)}
                className="px-2 py-0.5 bg-white dark:bg-slate-800 text-[11px] font-mono rounded border border-slate-200 dark:border-slate-700 hover:text-amber-500 disabled:opacity-50"
              >
                {pop.ticker}
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {editingKey && (
              <button
                type="button"
                onClick={() => {
                  setEditingKey(null);
                  setTicker('');
                  setDate('');
                  setValue('');
                }}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-xs font-medium rounded-lg"
              >
                Отмена редактирования
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{editingKey ? 'Сохранить изменения' : 'Добавить дивиденд'}</span>
            </button>
          </div>
        </form>

        <div className="space-y-2 flex-1 overflow-y-auto pr-1">
          <h4 className="font-semibold text-xs text-slate-500">Внесенные вручную записи ({manualList.length}):</h4>

          {manualList.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 border border-dashed rounded-xl">
              Ручных записей пока нет. Воспользуйтесь кнопкой загрузки со Smart-Lab выше.
            </div>
          ) : (
            <div className="space-y-1.5 font-mono text-xs">
              {manualList.map(div => (
                <div key={`${div.ticker}_${div.date}`} className="p-3 bg-slate-50 dark:bg-slate-900/60 border rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sky-500 mr-2">{div.ticker}</span>
                    <span className="text-slate-400 mr-3">Отсечка: {div.date}</span>
                    <span className="font-bold text-emerald-500">+{div.value} ₽</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(div)} className="p-1 text-slate-400 hover:text-sky-500">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(div.ticker, div.date)} className="p-1 text-slate-400 hover:text-rose-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};