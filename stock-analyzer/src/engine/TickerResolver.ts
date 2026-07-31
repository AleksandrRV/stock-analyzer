import { ITickerRename, IStockSplit } from '../types/domain';

export const DEFAULT_TICKER_RENAMES: ITickerRename[] = [
  { oldTicker: 'TCSG', newTicker: 'T', changeDate: '2024-11-28T00:00:00.000Z' },
  { oldTicker: 'YNDX', newTicker: 'YDEX', changeDate: '2024-07-24T00:00:00.000Z' },
  { oldTicker: 'HHRU', newTicker: 'HEAD', changeDate: '2024-09-26T00:00:00.000Z' },
  { oldTicker: 'FIVE', newTicker: 'X5', changeDate: '2025-01-09T00:00:00.000Z' },
  { oldTicker: 'AGRO', newTicker: 'RAGR', changeDate: '2025-02-17T00:00:00.000Z' },
  { oldTicker: 'CIAN', newTicker: 'CNRU', changeDate: '2025-04-03T00:00:00.000Z' },
  { oldTicker: 'SFTL', newTicker: 'SOFL', changeDate: '2023-09-26T00:00:00.000Z' },
  { oldTicker: 'ISKJ', newTicker: 'ABIO', changeDate: '2023-08-18T00:00:00.000Z' },
  { oldTicker: 'MAIL', newTicker: 'VKCO', changeDate: '2021-12-14T00:00:00.000Z' },
];

export const DEFAULT_STOCK_SPLITS: IStockSplit[] = [
  { ticker: 'TRNFP', date: '2024-02-21T00:00:00.000Z', coefficient: 100 },
  { ticker: 'GMKN', date: '2024-04-08T00:00:00.000Z', coefficient: 100 },
  { ticker: 'GEMA', date: '2024-02-06T00:00:00.000Z', coefficient: 10 },
  { ticker: 'VTBR', date: '2024-07-15T00:00:00.000Z', coefficient: 0.0002 },
  { ticker: 'PLZL', date: '2025-04-01T00:00:00.000Z', coefficient: 10 },
  { ticker: 'T', date: '2026-04-17T00:00:00.000Z', coefficient: 10 },
  { ticker: 'FXUS', date: '2021-10-07T00:00:00.000Z', coefficient: 100 },
  { ticker: 'FXRL', date: '2021-10-07T00:00:00.000Z', coefficient: 100 },
  { ticker: 'FXRB', date: '2021-10-07T00:00:00.000Z', coefficient: 100 },
];

export class TickerResolver {
  static resolveTicker(inputTicker: string, targetDateIso: string, customRenames: ITickerRename[] = []): string {
    const cleanInput = inputTicker.trim().toUpperCase();
    if (!cleanInput) return '';

    const allRenames = [...DEFAULT_TICKER_RENAMES, ...customRenames];
    const targetTime = new Date(targetDateIso).getTime();

    for (const rule of allRenames) {
      const changeTime = new Date(rule.changeDate).getTime();
      if (cleanInput === rule.oldTicker && targetTime >= changeTime) return rule.newTicker;
      if (cleanInput === rule.newTicker && targetTime < changeTime) return rule.oldTicker;
    }
    return cleanInput;
  }

  static resolveTickerToCurrent(inputTicker: string, customRenames: ITickerRename[] = []): string {
    return this.resolveTicker(inputTicker, new Date().toISOString(), customRenames);
  }

  /**
   * Корректировка цен мертвых тикеров.
   * MOEX сама корректирует живые тикеры. Если тикер не менялся - мы ничего не делим (возвращаем 1.0).
   * Если мы смотрим старый тикер (TCSG), мы должны применить к нему сплиты наследника (T).
   */
  static getPriceAdjustmentToToday(rawTicker: string, dateIso: string, customRenames: ITickerRename[] = [], customSplits: IStockSplit[] = []): number {
    const cleanTicker = rawTicker.trim().toUpperCase();
    const currentTicker = this.resolveTickerToCurrent(cleanTicker, customRenames);
    
    if (cleanTicker === currentTicker) {
      return 1.0;
    }

    let cumulativeCoefficient = 1.0;
    const allSplits = [...DEFAULT_STOCK_SPLITS, ...customSplits];
    const allRenames = [...DEFAULT_TICKER_RENAMES, ...customRenames];

    const renameRule = allRenames.find(r => r.oldTicker === cleanTicker && r.newTicker === currentTicker);
    if (!renameRule) return 1.0;

    const renameTime = new Date(renameRule.changeDate).getTime();

    for (const split of allSplits) {
      if (split.ticker === currentTicker) {
        const splitTime = new Date(split.date).getTime();
        // Применяем только те сплиты нового тикера, которые случились ПОСЛЕ "смерти" старого тикера
        if (splitTime >= renameTime) {
          cumulativeCoefficient *= split.coefficient;
        }
      }
    }
    return cumulativeCoefficient;
  }

  /**
   * Корректировка номинальных дивидендов.
   * Дивиденды MOEX всегда отдает абсолютными. Их нужно делить на все сплиты, произошедшие после даты отсечки.
   */
  static getDividendAdjustmentToToday(currentTicker: string, divDateIso: string, customSplits: IStockSplit[] = []): number {
    let cumulativeCoefficient = 1.0;
    const allSplits = [...DEFAULT_STOCK_SPLITS, ...customSplits];
    const divTime = new Date(divDateIso).getTime();

    for (const split of allSplits) {
      if (split.ticker === currentTicker) {
        const splitTime = new Date(split.date).getTime();
        if (splitTime > divTime) {
          cumulativeCoefficient *= split.coefficient;
        }
      }
    }
    return cumulativeCoefficient;
  }
}