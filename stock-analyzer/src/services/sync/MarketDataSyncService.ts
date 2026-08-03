import { marketDb } from '../../db/marketDb';
import { MoexApiGateway } from '../api/MoexApiGateway';
import { TickerResolver } from '../../engine/TickerResolver';
import { DateTimeStandardizer } from '../../engine/DateTimeStandardizer';
import { CalendarAdjuster } from '../../engine/CalendarAdjuster';
import { AssetType, IDividendHistory } from '../../types/domain';

export interface ISyncPriceResult {
  ticker: string;
  requestedDate: string;
  actualTradeDate: string;
  price: number;
  source: 'INDEXED_DB' | 'MOEX_API';
}

const requestLocks = new Map<string, Promise<any>>();

export class MarketDataSyncService {
  
  private static async withLock<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (requestLocks.has(key)) {
      return requestLocks.get(key) as Promise<T>;
    }
    const promise = fetcher().finally(() => requestLocks.delete(key));
    requestLocks.set(key, promise);
    return promise;
  }

  // ДОБАВЛЕН АРГУМЕНТ assetType
  static async getOrFetchPrice(rawTicker: string, utcIsoString: string, assetType?: AssetType | 'INDEX'): Promise<ISyncPriceResult | null> {
    const resolvedTicker = TickerResolver.resolveTicker(rawTicker, utcIsoString);
    const mskDateStr = DateTimeStandardizer.toMSKDateString(utcIsoString);
    
    const lockKey = `PRICE_${resolvedTicker}_${mskDateStr}`;

    return this.withLock(lockKey, async () => {
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

      const moexRes = await MoexApiGateway.fetchClosePrice(resolvedTicker, mskDateStr);
      if (!moexRes) return null;

      // СОХРАНЯЕМ ТИП В БАЗУ ДЛЯ ТОЧНОЙ ОЧИСТКИ
      await marketDb.prices.put({
        ticker: resolvedTicker,
        date: mskDateStr,
        price: moexRes.price,
        type: assetType, // STOCK, FUND или INDEX
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
        type: 'INDEX', // Помечаем как ИНДЕКС
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

      if (hasOfficial && isFresh) {
        return cached;
      }

      const fetched = await MoexApiGateway.fetchDividends(resolvedTicker);
      if (fetched.length > 0) {
        await marketDb.reconcileAndSaveMoexDividends(resolvedTicker, fetched);
      }
      
      await marketDb.setCacheUpdated(lockKey);
      return await marketDb.dividends.where('ticker').equals(resolvedTicker).toArray();
    });
  }
}