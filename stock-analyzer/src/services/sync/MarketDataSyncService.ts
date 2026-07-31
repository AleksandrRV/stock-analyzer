import { marketDb } from '../../db/marketDb';
import { MoexApiGateway } from '../api/MoexApiGateway';
import { TickerResolver } from '../../engine/TickerResolver';
import { DateTimeStandardizer } from '../../engine/DateTimeStandardizer';
import { CalendarAdjuster } from '../../engine/CalendarAdjuster';
import { IDividendHistory } from '../../types/domain';

export interface ISyncPriceResult {
  ticker: string;
  requestedDate: string; // MSK дата
  actualTradeDate: string; // Фактическая дата торгов
  price: number;
  source: 'INDEXED_DB' | 'MOEX_API';
}

export class MarketDataSyncService {
  /**
   * Оркестратор Read-Through Cache для активов и фондов (включая LQDT)
   */
  static async getOrFetchPrice(
    rawTicker: string,
    utcIsoString: string
  ): Promise<ISyncPriceResult | null> {
    const resolvedTicker = TickerResolver.resolveTicker(rawTicker, utcIsoString);
    const mskDateStr = DateTimeStandardizer.toMSKDateString(utcIsoString);

    // 1. Проверяем IndexedDB
    const cached = await marketDb.prices
      .where({ ticker: resolvedTicker, date: mskDateStr })
      .first();

    if (cached) {
      return {
        ticker: resolvedTicker,
        requestedDate: mskDateStr,
        actualTradeDate: cached.date,
        price: cached.price,
        source: 'INDEXED_DB',
      };
    }

    // 2. Если в БД нет — запрашиваем MOEX API
    const moexRes = await MoexApiGateway.fetchClosePrice(resolvedTicker, mskDateStr);
    if (!moexRes) return null;

    // 3. Сохраняем результат в IndexedDB под запрошенной датой
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
  }

  /**
   * Оркестратор Read-Through Cache для индекса MCFTR
   */
  static async getOrFetchMCFTR(utcIsoString: string): Promise<ISyncPriceResult | null> {
    const mskDateStr = DateTimeStandardizer.toMSKDateString(utcIsoString);

    // 1. Проверяем IndexedDB
    const cached = await marketDb.prices
      .where({ ticker: 'MCFTR', date: mskDateStr })
      .first();

    if (cached) {
      return {
        ticker: 'MCFTR',
        requestedDate: mskDateStr,
        actualTradeDate: cached.date,
        price: cached.price,
        source: 'INDEXED_DB',
      };
    }

    // 2. Запрашиваем MOEX с интервалом поиска на случай выходного
    const fromDateStr = CalendarAdjuster.getFromDateForSearch(mskDateStr);
    const moexRes = await MoexApiGateway.fetchMCFTRIndex(fromDateStr, mskDateStr);
    if (!moexRes) return null;

    // 3. Записываем в IndexedDB
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
  }

  /**
   * Оркестратор для загрузки дивидендов
   */
  static async getOrFetchDividends(rawTicker: string): Promise<IDividendHistory[]> {
    const resolvedTicker = rawTicker.trim().toUpperCase();

    // 1. Проверяем в IndexedDB
    const cached = await marketDb.dividends.where('ticker').equals(resolvedTicker).toArray();
    if (cached.length > 0) {
      return cached;
    }

    // 2. Качаем с MOEX API
    const fetched = await MoexApiGateway.fetchDividends(resolvedTicker);
    if (fetched.length > 0) {
      // Кэшируем пачкой в IndexedDB
      await marketDb.dividends.bulkPut(fetched);
    }

    return fetched;
  }
}