import { IDividendHistory } from '../../types/domain';

const BASE_URL = 'https://iss.moex.com/iss';

export interface IMoexPriceResult {
  tradeDate: string; // Фактическая дата торговой сессии YYYY-MM-DD
  price: number;
}

export class MoexApiGateway {
  /**
   * Получает динамический индекс колонки по её названию
   */
  private static getColumnIndex(columns: string[], columnName: string): number {
    return columns.findIndex(col => col.toUpperCase() === columnName.toUpperCase());
  }

  /**
   * Загружает цену закрытия акции или фонда на заданную дату (или ближайшую прошлую торговую сессию)
   */
  static async fetchClosePrice(
    ticker: string,
    mskDateString: string
  ): Promise<IMoexPriceResult | null> {
    try {
      // Использование iss.reverse=true отдает свечи до указанной даты в обратном порядке.
      // Первая свеча в массиве — это последняя доступная торговая сессия на/до указанной даты!
      const url = `${BASE_URL}/engines/stock/markets/shares/securities/${ticker.toUpperCase()}/candles.json?iss.reverse=true&till=${mskDateString} 23:59:59&interval=24&marketprice_board=1`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Ошибка сети: ${response.status}`);
      
      const json = await response.json();
      const candles = json.candles;

      if (!candles || !candles.data || candles.data.length === 0) {
        return null;
      }

      const closeIdx = this.getColumnIndex(candles.columns, 'close');
      const endIdx = this.getColumnIndex(candles.columns, 'end');

      const firstCandle = candles.data[0];
      const rawPrice = firstCandle[closeIdx];
      const rawDateStr = firstCandle[endIdx]; // 'YYYY-MM-DD HH:mm:ss'

      const price = typeof rawPrice === 'string' ? parseFloat(rawPrice.replace(',', '.')) : Number(rawPrice);
      const tradeDate = rawDateStr.split(' ')[0];

      return { tradeDate, price };
    } catch (error) {
      console.error(`[MoexApiGateway] Ошибка загрузки цены ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Загружает исторические значения индекса MCFTR за выбранную дату
   */
  static async fetchMCFTRIndex(
    fromMskDate: string,
    tillMskDate: string
  ): Promise<IMoexPriceResult | null> {
    try {
      const url = `${BASE_URL}/history/engines/stock/markets/index/securities/MCFTR.json?from=${fromMskDate}&till=${tillMskDate}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Ошибка сети: ${response.status}`);
      
      const json = await response.json();
      const history = json.history;

      if (!history || !history.data || history.data.length === 0) {
        return null;
      }

      const closeIdx = this.getColumnIndex(history.columns, 'CLOSE');
      const dateIdx = this.getColumnIndex(history.columns, 'TRADEDATE');

      // Берём последнюю доступную запись из массива за этот период
      const lastRow = history.data[history.data.length - 1];
      const rawPrice = lastRow[closeIdx];
      const tradeDate = String(lastRow[dateIdx]);

      const price = typeof rawPrice === 'string' ? parseFloat(rawPrice.replace(',', '.')) : Number(rawPrice);

      return { tradeDate, price };
    } catch (error) {
      console.error(`[MoexApiGateway] Ошибка загрузки индекса MCFTR:`, error);
      return null;
    }
  }

  /**
   * Загружает всю историю дивидендов по тикеру
   */
  static async fetchDividends(ticker: string): Promise<IDividendHistory[]> {
    try {
      const url = `${BASE_URL}/securities/${ticker.toUpperCase()}/dividends.json`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Ошибка сети: ${response.status}`);
      
      const json = await response.json();
      const dividends = json.dividends;

      if (!dividends || !dividends.data || dividends.data.length === 0) {
        return [];
      }

      const dateIdx = this.getColumnIndex(dividends.columns, 'registryclosedate');
      const valueIdx = this.getColumnIndex(dividends.columns, 'value');

      const results: IDividendHistory[] = [];

      for (const row of dividends.data) {
        const rawDate = String(row[dateIdx]);
        const rawValue = row[valueIdx];
        const value = typeof rawValue === 'string' ? parseFloat(rawValue.replace(',', '.')) : Number(rawValue);

        if (rawDate && !isNaN(value)) {
          results.push({
            ticker: ticker.toUpperCase(),
            date: rawDate,
            value,
          });
        }
      }

      return results;
    } catch (error) {
      console.error(`[MoexApiGateway] Ошибка загрузки дивидендов ${ticker}:`, error);
      return [];
    }
  }
}