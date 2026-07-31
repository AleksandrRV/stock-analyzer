import Dexie, { Table } from 'dexie';
import { IPriceHistory, IDividendHistory } from '../types/domain';

export class MarketDatabase extends Dexie {
  prices!: Table<IPriceHistory>;
  dividends!: Table<IDividendHistory>;

  constructor() {
    super('MarketCacheDB');

    this.version(1).stores({
      prices: '++id, [ticker+date], ticker, date',
      dividends: '++id, [ticker+date], ticker, date',
    });
  }

  // 1. Очистка ТОЛЬКО цен акций (исключая индексы и кэш-фонды)
  async clearStockPricesOnly() {
    await this.prices
      .filter(p => p.ticker !== 'MCFTR' && p.ticker !== 'LQDT')
      .delete();
  }

  // 2. Очистка ТОЛЬКО цен фондов (LQDT)
  async clearFundPricesOnly() {
    await this.prices.where('ticker').equals('LQDT').delete();
  }

  // 3. Очистка ТОЛЬКО значений индексов (MCFTR)
  async clearIndicesOnly() {
    await this.prices.where('ticker').equals('MCFTR').delete();
  }

  // 4. Очистка ТОЛЬКО истории дивидендов
  async clearDividendsOnly() {
    await this.dividends.clear();
  }

  // 5. ПОЛНАЯ очистка рыночного кэша
  async clearAllCache() {
    await this.prices.clear();
    await this.dividends.clear();
  }

  // Статистика записей в кэше
  async getCacheStats() {
    const pricesCount = await this.prices.count();
    const dividendsCount = await this.dividends.count();
    return { pricesCount, dividendsCount };
  }
}

export const marketDb = new MarketDatabase();