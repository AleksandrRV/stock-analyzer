import Dexie, { Table } from 'dexie';
import { IPriceHistory, IDividendHistory } from '../types/domain';

interface ICacheMeta {
  key: string; // Например "DIV_SBER" или "PRICE_SBER_2024-01-01"
  lastUpdatedMs: number;
}

export class MarketDatabase extends Dexie {
  prices!: Table<IPriceHistory, [string, string]>; // PK = [ticker, date]
  dividends!: Table<IDividendHistory, [string, string]>; // PK = [ticker, date]
  meta!: Table<ICacheMeta, string>;

  constructor() {
    super('MarketCacheDB');

    // Версия 2: Переход на составные первичные ключи для абсолютной дедупликации!
    this.version(2).stores({
      prices: '[ticker+date], ticker, date',
      dividends: '[ticker+date], ticker, date, isManual',
      meta: 'key',
    });
  }

  // Проверка актуальности кэша (TTL)
  async isCacheValid(key: string, ttlMs: number): Promise<boolean> {
    const record = await this.meta.get(key);
    if (!record) return false;
    return (Date.now() - record.lastUpdatedMs) < ttlMs;
  }

  async setCacheUpdated(key: string) {
    await this.meta.put({ key, lastUpdatedMs: Date.now() });
  }

  // Дивиденды +- 30 дней
  async hasDividendInWindow(ticker: string, dateStr: string, windowDays = 30): Promise<boolean> {
    const cleanTicker = ticker.trim().toUpperCase();
    const targetTime = new Date(dateStr).getTime();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;

    const existing = await this.dividends.where('ticker').equals(cleanTicker).toArray();
    return existing.some(div => Math.abs(new Date(div.date).getTime() - targetTime) <= windowMs);
  }

  // Сверка и автоматическая очистка ручных дивидендов
  async reconcileAndSaveMoexDividends(ticker: string, moexDividends: IDividendHistory[]) {
    const cleanTicker = ticker.trim().toUpperCase();
    const windowMs = 30 * 24 * 60 * 60 * 1000;

    const existingManuals = await this.dividends
      .where('ticker')
      .equals(cleanTicker)
      .filter(d => !!d.isManual)
      .toArray();

    // Находим ключи ручных записей для удаления
    const manualKeysToDelete: [string, string][] = [];

    for (const manual of existingManuals) {
      const manualTime = new Date(manual.date).getTime();
      const hasMatch = moexDividends.some(moexDiv => Math.abs(new Date(moexDiv.date).getTime() - manualTime) <= windowMs);
      
      if (hasMatch) {
        manualKeysToDelete.push([manual.ticker, manual.date]);
      }
    }

    if (manualKeysToDelete.length > 0) {
      await this.dividends.bulkDelete(manualKeysToDelete);
    }

    if (moexDividends.length > 0) {
      // Идеальное сохранение: bulkPut на составной ключ строго ПЕРЕЗАПИСЫВАЕТ данные
      await this.dividends.bulkPut(moexDividends);
    }
  }

  async getAllManualDividends(): Promise<IDividendHistory[]> {
    return await this.dividends.filter(d => !!d.isManual).toArray();
  }

  async clearStockPricesOnly() {
    await this.prices.filter(p => p.ticker !== 'MCFTR' && p.ticker !== 'LQDT').delete();
    await this.meta.filter(m => m.key.startsWith('PRICE_') && !m.key.includes('MCFTR') && !m.key.includes('LQDT')).delete();
  }
  async clearFundPricesOnly() {
    await this.prices.where('ticker').equals('LQDT').delete();
  }
  async clearIndicesOnly() {
    await this.prices.where('ticker').equals('MCFTR').delete();
  }
  async clearDividendsOnly() {
    await this.dividends.clear();
    await this.meta.filter(m => m.key.startsWith('DIV_')).delete();
  }
  async clearAllCache() {
    await this.prices.clear();
    await this.dividends.clear();
    await this.meta.clear();
  }
  async getCacheStats() {
    return { pricesCount: await this.prices.count(), dividendsCount: await this.dividends.count() };
  }
}

export const marketDb = new MarketDatabase();