import Dexie, { Table } from 'dexie';
import { IPriceHistory, IDividendHistory } from '../types/domain';

export class MarketDatabase extends Dexie {
  prices!: Table<IPriceHistory>;
  dividends!: Table<IDividendHistory>;

  constructor() {
    super('MarketCacheDB');

    // Схема базы данных
    this.version(1).stores({
      prices: '++id, [ticker+date], ticker, date',
      dividends: '++id, [ticker+date], ticker, date',
    });
  }

  // Гранулярная очистка кэша
  async clearPricesOnly() {
    await this.prices.clear();
  }

  async clearDividendsOnly() {
    await this.dividends.clear();
  }

  async clearAllCache() {
    await this.prices.clear();
    await this.dividends.clear();
  }
}

export const marketDb = new MarketDatabase();