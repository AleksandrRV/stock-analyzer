import { marketDb } from '../../db/marketDb';
import { MoexApiGateway } from '../api/MoexApiGateway';
import { TickerResolver } from '../../engine/TickerResolver';
import { DateTimeStandardizer } from '../../engine/DateTimeStandardizer';
import { CalendarAdjuster } from '../../engine/CalendarAdjuster';
import { IDividendHistory } from '../../types/domain';

export interface ISyncPriceResult {
  ticker: string;
  requestedDate: string;
  actualTradeDate: string;
  price: number;
  source: 'INDEXED_DB' | 'MOEX_API';
}

// Оперативный кэш промисов (Анти-спам одновременных запросов)
const requestLocks = new Map<string, Promise<any>>();

export class MarketDataSyncService {
  
  // Универсальная обертка для дедупликации одновременных асинхронных вызовов
  private static async withLock<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (requestLocks.has(key)) {
      return requestLocks.get(key) as Promise<T>;
    }
    const promise = fetcher().finally(() => requestLocks.delete(key));
    requestLocks.set(key, promise);
    return promise;
  }

  static async getOrFetchPrice(rawTicker: string, utcIsoString: string): Promise<ISyncPriceResult | null> {
    const resolvedTicker = TickerResolver.resolveTicker(rawTicker, utcIsoString);
    const mskDateStr = DateTimeStandardizer.toMSKDateString(utcIsoString);
    
    // Блокирующий ключ для RAM: "SBER_2024-01-01"
    const lockKey = `${resolvedTicker}_${mskDateStr}`;

    return this.withLock(lockKey, async () => {
      // 1. Проверяем IndexedDB
      const cached = await marketDb.prices.get([resolvedTicker, mskDateStr]);
      if (cached) {
        return {
          ticker: resolvedTicker,
          requestedDate: mskDateStr,
          actualTradeDate: cached.date,
          price: cached.price,
          source: 'INDEXED_DB',
        };
      }

      // 2. Идем в API
      const moexRes = await MoexApiGateway.fetchClosePrice(resolvedTicker, mskDateStr);
      if (!moexRes) return null;

      // 3. Сохраняем в БД (Составной ключ перезапишет дубли)
      await marketDb.prices.put({
        ticker: resolvedTicker,
        date: mskDateStr,
        price: moexRes.price,
      });

      return {
        ticker: resolvedTicker,
        requestedDate: mskDateStr,
        actualTradeDate: moexRes.tradeDate,
        price: moexRes.price,
        source: 'MOEX_API',
      };
    });
  }

  static async getOrFetchMCFTR(utcIsoString: string): Promise<ISyncPriceResult | null> {
    const mskDateStr = DateTimeStandardizer.toMSKDateString(utcIsoString);
    const lockKey = `MCFTR_${mskDateStr}`;

    return this.withLock(lockKey, async () => {
      const cached = await marketDb.prices.get(['MCFTR', mskDateStr]);
      if (cached) {
        return {
          ticker: 'MCFTR',
          requestedDate: mskDateStr,
          actualTradeDate: cached.date,
          price: cached.price,
          source: 'INDEXED_DB',
        };
      }

      const fromDateStr = CalendarAdjuster.getFromDateForSearch(mskDateStr);
      const moexRes = await MoexApiGateway.fetchMCFTRIndex(fromDateStr, mskDateStr);
      if (!moexRes) return null;

      await marketDb.prices.put({
        ticker: 'MCFTR',
        date: mskDateStr,
        price: moexRes.price,
      });

      return {
        ticker: 'MCFTR',
        requestedDate: mskDateStr,
        actualTradeDate: moexRes.tradeDate,
        price: moexRes.price,
        source: 'MOEX_API',
      };
    });
  }

  static async getOrFetchDividends(rawTicker: string): Promise<IDividendHistory[]> {
    const resolvedTicker = rawTicker.trim().toUpperCase();
    const lockKey = `DIV_${resolvedTicker}`;

    return this.withLock(lockKey, async () => {
      const TTL_24_HOURS = 24 * 60 * 60 * 1000;
      
      const cached = await marketDb.dividends.where('ticker').equals(resolvedTicker).toArray();
      const hasOfficial = cached.some(d => !d.isManual);
      const isFresh = await marketDb.isCacheValid(lockKey, TTL_24_HOURS);

      // Если есть официальные данные И они свежие (проверяли менее 24ч назад) -> отдаем кэш
      if (hasOfficial && isFresh) {
        return cached;
      }

      // Иначе -> идем на Мосбиржу
      const fetched = await MoexApiGateway.fetchDividends(resolvedTicker);
      
      if (fetched.length > 0) {
        await marketDb.reconcileAndSaveMoexDividends(resolvedTicker, fetched);
      }
      
      // Отмечаем время успешной проверки
      await marketDb.setCacheUpdated(lockKey);

      return await marketDb.dividends.where('ticker').equals(resolvedTicker).toArray();
    });
  }
}