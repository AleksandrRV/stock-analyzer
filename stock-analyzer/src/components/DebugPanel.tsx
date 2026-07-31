import React, { useState } from 'react';
import { DateTimeStandardizer } from '../engine/DateTimeStandardizer';
import { FinancialMath } from '../engine/FinancialMath';
import { TickerResolver } from '../engine/TickerResolver';
import { marketDb } from '../db/marketDb';
import { MarketDataSyncService, ISyncPriceResult } from '../services/sync/MarketDataSyncService';
import { IDividendHistory } from '../types/domain';
import { Calculator, Clock, Database, RefreshCw, Globe, ArrowDownCircle } from 'lucide-react';

export const DebugPanel: React.FC = () => {
  // Тест часовых поясов
  const [selectedLocalTime, setSelectedLocalTime] = useState(
    new Date().toISOString().slice(0, 16)
  );

  // Тест математики
  const [monthlyInput, setMonthlyInput] = useState<number>(1.0);

  // Тест тикеров
  const [testTicker, setTestTicker] = useState('TCSG');
  const [testDate, setTestDate] = useState('2025-02-01');

  // Результаты Dexie
  const [dbStatus, setDbStatus] = useState<string>('БД не проверялась');

  // Результаты MOEX API (Этап 3)
  const [moexTicker, setMoexTicker] = useState('SBER');
  const [moexDate, setMoexDate] = useState('2024-02-17'); // Суббота для проверки сдвига!
  const [moexResult, setMoexResult] = useState<ISyncPriceResult | null>(null);
  const [dividendsResult, setDividendsResult] = useState<IDividendHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const utcString = DateTimeStandardizer.toUTCISOString(new Date(selectedLocalTime));
  const mskDate = DateTimeStandardizer.toMSKDateString(utcString);
  const localDisplay = DateTimeStandardizer.formatToLocalDisplay(utcString);

  const annualResult = FinancialMath.calculateAnnualizedRate(monthlyInput);
  const resolvedTicker = TickerResolver.resolveTicker(testTicker, `${testDate}T12:00:00.000Z`);

  const handleTestDb = async () => {
    try {
      await marketDb.prices.put({
        ticker: 'TEST_SBER',
        date: '2025-01-01',
        price: 250.5,
      });
      const count = await marketDb.prices.count();
      setDbStatus(`Успешно! Записей в таблице цен: ${count}`);
    } catch (e) {
      setDbStatus(`Ошибка БД: ${e}`);
    }
  };

  const handleClearDb = async () => {
    await marketDb.clearAllCache();
    const count = await marketDb.prices.count();
    setDbStatus(`Кэш очищен. Записей: ${count}`);
    setMoexResult(null);
    setDividendsResult([]);
  };

  // ТЕСТ MOEX API & CACHE
  const handleFetchPrice = async () => {
    setLoading(true);
    const targetUtc = new Date(`${moexDate}T12:00:00.000Z`).toISOString();
    
    let res: ISyncPriceResult | null = null;
    if (moexTicker.toUpperCase() === 'MCFTR') {
      res = await MarketDataSyncService.getOrFetchMCFTR(targetUtc);
    } else {
      res = await MarketDataSyncService.getOrFetchPrice(moexTicker, targetUtc);
    }

    setMoexResult(res);
    setLoading(false);
  };

  const handleFetchDividends = async () => {
    setLoading(true);
    const divs = await MarketDataSyncService.getOrFetchDividends(moexTicker);
    setDividendsResult(divs);
    setLoading(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 space-y-6 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-4">
        <Calculator className="w-5 h-5 text-sky-500" />
        <h3 className="font-bold text-lg">Песочница матем. ядра, БД и MOEX API (Этап 3)</h3>
      </div>

      {/* НОВЫЙ БЛОК: ТЕСТИРОВАНИЕ MOEX API И КЭША */}
      <div className="p-4 bg-sky-500/5 border border-sky-500/20 rounded-xl space-y-4">
        <div className="flex items-center gap-2 font-semibold text-sm text-sky-600 dark:text-sky-400">
          <Globe className="w-4 h-4" />
          <span>Тест MOEX API + Read-Through Cache (Живые запросы)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Тикер (Акции/Фонды/MCFTR):</label>
            <input
              type="text"
              value={moexTicker}
              onChange={e => setMoexTicker(e.target.value)}
              className="w-full p-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-mono uppercase"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Дата (Попробуйте выходной!):</label>
            <input
              type="date"
              value={moexDate}
              onChange={e => setMoexDate(e.target.value)}
              className="w-full p-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleFetchPrice}
              disabled={loading}
              className="flex-1 p-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all"
            >
              {loading ? 'Загрузка...' : 'Запросить цену'}
            </button>
            <button
              onClick={handleFetchDividends}
              disabled={loading}
              className="px-3 p-2 bg-slate-200 dark:bg-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
              title="Запросить дивиденды"
            >
              <ArrowDownCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Результат запроса цены */}
        {moexResult && (
          <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border text-xs space-y-1 font-mono">
            <div className="flex justify-between border-b pb-1">
              <span>Преобразованный тикер:</span>
              <span className="font-bold text-purple-500">{moexResult.ticker}</span>
            </div>
            <div className="flex justify-between border-b py-1">
              <span>Источник данных:</span>
              <span className={`font-bold px-1.5 py-0.5 rounded ${
                moexResult.source === 'INDEXED_DB' 
                  ? 'bg-emerald-500/10 text-emerald-500' 
                  : 'bg-amber-500/10 text-amber-500'
              }`}>
                {moexResult.source === 'INDEXED_DB' ? '⚡ ЛОКАЛЬНЫЙ КЭШ (IndexedDB)' : '🌐 MOEX API (Сеть)'}
              </span>
            </div>
            <div className="flex justify-between border-b py-1">
              <span>Запрошенная дата (МСК):</span>
              <span>{moexResult.requestedDate}</span>
            </div>
            <div className="flex justify-between border-b py-1">
              <span>Фактическая дата сессии (Сдвиг):</span>
              <span className="text-sky-500">{moexResult.actualTradeDate}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span>Цена закрытия:</span>
              <span className="text-lg font-bold text-emerald-500">{moexResult.price} ₽</span>
            </div>
          </div>
        )}

        {/* Результат дивидендов */}
        {dividendsResult.length > 0 && (
          <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border text-xs space-y-2">
            <div className="font-semibold text-slate-500">Найдено дивидендов: {dividendsResult.length} шт. (Первые 3):</div>
            <div className="space-y-1 font-mono">
              {dividendsResult.slice(0, 3).map((div, idx) => (
                <div key={idx} className="flex justify-between border-b border-dashed pb-1">
                  <span>Отсечка: {div.date}</span>
                  <span className="font-bold text-emerald-500">+{div.value} ₽</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Тест часовых поясов */}
        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>Конвертер часовых поясов</span>
          </div>
          <input
            type="datetime-local"
            value={selectedLocalTime}
            onChange={e => setSelectedLocalTime(e.target.value)}
            className="w-full p-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
          />
          <div className="text-xs space-y-1 font-mono">
            <div>Локальное отображение: <span className="text-sky-500 font-bold">{localDisplay}</span></div>
            <div>Хранение в БД (UTC): <span className="text-emerald-500">{utcString}</span></div>
            <div>Запрос к MOEX (МСК дата): <span className="text-purple-500">{mskDate}</span></div>
          </div>
        </div>

        {/* Тест сложного процента */}
        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Calculator className="w-4 h-4 text-emerald-500" />
            <span>Проверка сложного процента</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">Доходность в месяц (%):</span>
            <input
              type="number"
              step="0.1"
              value={monthlyInput}
              onChange={e => setMonthlyInput(parseFloat(e.target.value) || 0)}
              className="w-24 p-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
            />
          </div>
          <div className="text-xs font-mono">
            Годовая доходность (1.01^12):{' '}
            <span className="text-emerald-500 font-bold">{annualResult.toFixed(2)}%</span>
          </div>
        </div>

        {/* Тест тикеров */}
        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <RefreshCw className="w-4 h-4 text-purple-500" />
            <span>Машина времени тикеров</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={testTicker}
              onChange={e => setTestTicker(e.target.value)}
              className="p-1.5 text-sm bg-white dark:bg-slate-800 border rounded-lg"
              placeholder="Тикер"
            />
            <input
              type="date"
              value={testDate}
              onChange={e => setTestDate(e.target.value)}
              className="p-1.5 text-sm bg-white dark:bg-slate-800 border rounded-lg"
            />
          </div>
          <div className="text-xs font-mono">
            Преобразованный тикер:{' '}
            <span className="text-purple-500 font-bold">{resolvedTicker}</span>
          </div>
        </div>

        {/* Тест IndexedDB */}
        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Database className="w-4 h-4 text-sky-500" />
            <span>Проверка Dexie (IndexedDB)</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleTestDb}
              className="px-3 py-1.5 bg-sky-500 text-white text-xs font-medium rounded-lg hover:bg-sky-600"
            >
              Записать тестовую цену
            </button>
            <button
              onClick={handleClearDb}
              className="px-3 py-1.5 bg-rose-500/10 text-rose-500 text-xs font-medium rounded-lg hover:bg-rose-500/20"
            >
              Очистить кэш
            </button>
          </div>
          <div className="text-xs font-mono text-slate-500">{dbStatus}</div>
        </div>
      </div>
    </div>
  );
};