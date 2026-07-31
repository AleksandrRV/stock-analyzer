import Dexie, { Table } from 'dexie';
import { IPriceHistory, IDividendHistory } from '../types/domain';

export class MarketDatabase extends Dexie {
  prices!: Table<IPriceHistory>;
  dividends!: Table<IDividendHistory>;

  constructor() {
    super('MarketCacheDB');

    this.version(1).stores({
      prices: '++id, [ticker+date], ticker, date',
      dividends: '++id, [ticker+date], ticker, date, isManual',
    });
  }

  // Проверка: есть ли уже дивиденд по тикеру в интервале +-30 дней от даты
  async hasDividendInWindow(ticker: string, dateStr: string, windowDays = 30): Promise<boolean> {
    const cleanTicker = ticker.trim().toUpperCase();
    const targetTime = new Date(dateStr).getTime();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;

    const existing = await this.dividends.where('ticker').equals(cleanTicker).toArray();

    return existing.some(div => {
      const divTime = new Date(div.date).getTime();
      return Math.abs(divTime - targetTime) <= windowMs;
    });
  }

  // Сверка и автоматическая очистка ручных дивидендов при подгрузке с MOEX
  async reconcileAndSaveMoexDividends(ticker: string, moexDividends: IDividendHistory[]) {
    const cleanTicker = ticker.trim().toUpperCase();
    const windowMs = 30 * 24 * 60 * 60 * 1000;

    // Находим все текущие ручные дивиденды по этой бумаге
    const existingManuals = await this.dividends
      .where('ticker')
      .equals(cleanTicker)
      .filter(d => !!d.isManual)
      .toArray();

    // Если нашли совпадение по дате +-30 дней с официальными — удаляем ручные
    const manualIdsToDelete: number[] = [];

    for (const manual of existingManuals) {
      const manualTime = new Date(manual.date).getTime();
      const hasOfficialMatch = moexDividends.some(moexDiv => {
        const moexTime = new Date(moexDiv.date).getTime();
        return Math.abs(moexTime - manualTime) <= windowMs;
      });

      if (hasOfficialMatch && manual.id) {
        manualIdsToDelete.push(manual.id);
      }
    }

    if (manualIdsToDelete.length > 0) {
      await this.dividends.bulkDelete(manualIdsToDelete);
    }

    // Сохраняем официальные с MOEX
    if (moexDividends.length > 0) {
      await this.dividends.bulkPut(moexDividends);
    }
  }

  // Получить все ручные дивиденды
  async getAllManualDividends(): Promise<IDividendHistory[]> {
    return await this.dividends.filter(d => !!d.isManual).toArray();
  }

  // Очистки
  async clearStockPricesOnly() {
    await this.prices
      .filter(p => p.ticker !== 'MCFTR' && p.ticker !== 'LQDT')
      .delete();
  }

  async clearFundPricesOnly() {
    await this.prices.where('ticker').equals('LQDT').delete();
  }

  async clearIndicesOnly() {
    await this.prices.where('ticker').equals('MCFTR').delete();
  }

  async clearDividendsOnly() {
    await this.dividends.clear();
  }

  async clearAllCache() {
    await this.prices.clear();
    await this.dividends.clear();
  }

  async getCacheStats() {
    const pricesCount = await this.prices.count();
    const dividendsCount = await this.dividends.count();
    return { pricesCount, dividendsCount };
  }
}

export const marketDb = new MarketDatabase();