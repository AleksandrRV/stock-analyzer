import React, { useState, useEffect } from 'react';
import { IDividendHistory } from '../../types/domain';
import { marketDb } from '../../db/marketDb';
import { usePortfolioStore } from '../../store/usePortfolioStore';
import { POPULAR_MOEX_ASSETS } from '../../constants/defaultStocks';
import { SmartLabGateway } from '../../services/api/SmartLabGateway';
import { BcsDividendsGateway } from '../../services/api/BcsDividendsGateway';
import { InvestmintGateway } from '../../services/api/InvestmintGateway';
import { DividendFeedService, DividendFeedSource } from '../../services/api/DividendFeedService';
import { appLogger } from '../../services/logging/appLogger';
import { Coins, Plus, Trash2, Edit3, AlertTriangle, Check, X, Globe, Loader2, Landmark, Newspaper } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualDividendsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { loadFromStorage, clearCalculationCache, settings } = usePortfolioStore();

  const [manualList, setManualList] = useState<IDividendHistory[]>([]);
  const [ticker, setTicker] = useState('');
  const [date, setDate] = useState('');
  const [value, setValue] = useState('');
  
  const [editingKey, setEditingKey] = useState<[string, string] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  type ImportSource = 'smartlab' | 'bcs' | 'investmint';
  const [loadingSource, setLoadingSource] = useState<ImportSource | null>(null);

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

  const fetchSource = async (
    source: ImportSource,
  ): Promise<{ rows: IDividendHistory[]; generatedAt: string | null }> => {
    const proxy = settings.smartlabProxyUrl;

    // 1) Сначала пробуем статический кэш, который публикует GitHub Actions
    //    на том же домене (без CORS и прокси).
    const feedSource: DividendFeedSource = source; // 'smartlab' | 'bcs' | 'investmint'
    const feed = await DividendFeedService.fetchFeed();
    if (feed && feed.records && feed.records.length > 0) {
      const cached = DividendFeedService.bySource(feed, feedSource);
      if (cached.length > 0) {
        appLogger.success(
          'DividendFeed',
          `Данные для «${feedSource}» взяты из кэша GitHub Actions (обновлён ${feed.generatedAt}, записей: ${cached.length})`,
        );
        return { rows: cached, generatedAt: feed.generatedAt };
      }

      // Кэш есть, но именно для этого источника записей нет — источник не дал
      // данных при сборке на GitHub. Честно сообщаем причину и не лезем в сеть
      // (на устройстве без прокси это всё равно не сработает).
      const sourceErr = (feed.errors || []).find(e => e.toLowerCase().includes(feedSource));
      appLogger.warn('DividendFeed', `В кэше нет записей для «${feedSource}»: ${sourceErr || 'нет данных'}`);
      throw new Error(
        `Источник «${SOURCE_META[source].title}» не дал данных при сборке кэша на GitHub` +
        (sourceErr ? ` (${sourceErr})` : '') +
        `. Попробуйте Smart-Lab или Investmint.`,
      );
    }

    // 2) Кэша нет (например, не вышла новая версия приложения) — live-загрузка.
    const currentYear = new Date().getFullYear();
    const prevYear = currentYear - 1;

    if (source === 'smartlab') {
      const results = await Promise.allSettled([
        SmartLabGateway.fetchSmartLabDividends(currentYear, proxy),
        SmartLabGateway.fetchSmartLabDividends(prevYear, proxy),
      ]);
      const rows: IDividendHistory[] = [];
      const failures: string[] = [];
      results.forEach((res, idx) => {
        const year = idx === 0 ? currentYear : prevYear;
        if (res.status === 'fulfilled') rows.push(...res.value);
        else failures.push(`${year}: ${(res.reason as any)?.message || res.reason}`);
      });
      if (rows.length === 0 && failures.length > 0) throw new Error(failures.join('\n'));
      return { rows, generatedAt: null };
    }

    if (source === 'bcs') {
      return { rows: await BcsDividendsGateway.fetchPastDividends([currentYear, prevYear], proxy), generatedAt: null };
    }

    // investmint
    return { rows: await InvestmintGateway.fetchPastDividends(proxy), generatedAt: null };
  };

  const SOURCE_META: Record<ImportSource, { title: string; detail: string }> = {
    smartlab: { title: 'Smart-Lab', detail: `${new Date().getFullYear() - 1}–${new Date().getFullYear()}` },
    bcs: { title: 'BCS Экспресс', detail: 'прошедшие закрытия реестра' },
    investmint: { title: 'Investmint', detail: 'прошедшие дивиденды' },
  };

  const handleImport = async (source: ImportSource) => {
    setLoadingSource(source);
    setErrorMessage(null);
    setSuccessMessage(null);

    const meta = SOURCE_META[source];

    try {
      const { rows, generatedAt } = await fetchSource(source);

      if (rows.length === 0) {
        appLogger.error(meta.title, 'Источник вернул 0 записей');
        setErrorMessage(`Не удалось загрузить данные с ${meta.title}: источник вернул 0 записей.`);
        return;
      }

      const res = await marketDb.processSmartLabDividends(rows);

      const cacheNote = generatedAt
        ? ` (из кэша GitHub Actions, обновлён ${new Date(generatedAt).toLocaleString('ru-RU')})`
        : '';
      setSuccessMessage(`${meta.title} (${meta.detail}): Добавлено: ${res.added}, Обновлено: ${res.updated}, Пропущено (есть в MOEX): ${res.skipped}${cacheNote}`);
      appLogger.success(meta.title, `Импорт дивидендов: добавлено ${res.added}, обновлено ${res.updated}, пропущено ${res.skipped}`);
      await loadManualList();
      clearCalculationCache();
      loadFromStorage();
    } catch (err: any) {
      appLogger.error(meta.title, 'Ошибка при загрузке дивидендов', err?.message || String(err));
      setErrorMessage(`Ошибка загрузки с ${meta.title}: ${err?.message || err}`);
    } finally {
      setLoadingSource(null);
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

        {/* КНОПКИ ЗАГРУЗКИ ИЗ ВНЕШНИХ ИСТОЧНИКОВ */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Globe className="w-4 h-4 text-sky-500" />
            <span>Импорт дивидендов из внешних источников</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleImport('smartlab')}
              disabled={loadingSource !== null}
              className="px-3 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              {loadingSource === 'smartlab' ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Загрузка...</span></>
              ) : (
                <><Globe className="w-3.5 h-3.5" /><span>Smart-Lab</span></>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleImport('bcs')}
              disabled={loadingSource !== null}
              className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              {loadingSource === 'bcs' ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Загрузка...</span></>
              ) : (
                <><Landmark className="w-3.5 h-3.5" /><span>BCS Экспресс</span></>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleImport('investmint')}
              disabled={loadingSource !== null}
              className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              {loadingSource === 'investmint' ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Загрузка...</span></>
              ) : (
                <><Newspaper className="w-3.5 h-3.5" /><span>Investmint</span></>
              )}
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            Smart-Lab: {SOURCE_META.smartlab.detail} • BCS: {SOURCE_META.bcs.detail} • Investmint: {SOURCE_META.investmint.detail}. Записи добавляются как ручные и автоматически заменяются данными Мосбиржи при их появлении.
          </p>
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