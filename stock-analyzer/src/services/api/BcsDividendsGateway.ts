import { IDividendHistory } from '../../types/domain';
import { appLogger } from '../logging/appLogger';
import { fetchViaSources } from './httpSourceFetcher';

const SOURCE = 'BCS';
const API_URL = 'https://api.bcs.ru/divcalendar/v2/dividends';
const MAX_PAGES = 10;

interface IBcsDividendItem {
  id?: string | number;
  companyName?: string;
  secureCode?: string;      // тикер
  closingDate?: string;     // дата закрытия реестра DD.MM.YYYY
  dividendValue?: number | string;
  dividendCurrencyCode?: string;
  closePrice?: number | string;
  yield?: number | string;
  [key: string]: unknown;
}

interface IBcsResponse {
  data?: IBcsDividendItem[];
  hasMore?: boolean;
  lastValue?: number;
  total?: number;
}

/**
 * Шлюз к дивидендному календарю БКС Экспресс.
 *
 * Сама страница bcs-express.ru/dividednyj-kalendar рендерится на клиенте,
 * но её таблица получает данные из публичного JSON-API:
 *   https://api.bcs.ru/divcalendar/v2/dividends
 * Параметры: actual=0 (прошедшие закрытия реестра), limit=50, order=2,
 * sorting=1 (по дате покупки, по убыванию), year=<год>.
 */
export class BcsDividendsGateway {
  static async fetchPastDividends(years: number[], customProxyUrl?: string): Promise<IDividendHistory[]> {
    const results: IDividendHistory[] = [];
    const seen = new Set<string>();

    for (const year of years) {
      appLogger.info(SOURCE, `Загрузка прошедших закрытий реестра за ${year}`, API_URL);

      let lastValue: number | undefined;
      let pageCount = 0;

      while (pageCount < MAX_PAGES) {
        const params = new URLSearchParams({
          actual: '0',
          limit: '50',
          order: '2',
          sorting: '1',
          year: String(year),
        });
        if (lastValue !== undefined) params.set('lastValue', String(lastValue));

        const url = `${API_URL}?${params.toString()}`;

        const { text } = await fetchViaSources(url, {
          customProxyUrl,
          sourceName: SOURCE,
          headers: { Accept: 'application/json', Referer: 'https://bcs-express.ru/' },
          validate: this.validateJson,
        });

        let json: IBcsResponse;
        try {
          json = JSON.parse(text) as IBcsResponse;
        } catch (err: any) {
          appLogger.error(SOURCE, `Не удалось разобрать JSON ответа за ${year}`, `Ошибка: ${err?.message || err}`);
          throw new Error(`BCS (${year}): ответ не является валидным JSON`);
        }

        const data = Array.isArray(json.data) ? json.data : [];
        if (data.length === 0) break;

        for (const item of data) {
          const ticker = String(item.secureCode || '').trim().toUpperCase();
          const dateIso = this.parseDate(item.closingDate);
          const value = this.parseValue(item.dividendValue);

          if (!/^[A-Z0-9]{1,6}$/.test(ticker) || !dateIso || !value) continue;

          const key = `${ticker}_${dateIso}_${value}`;
          if (seen.has(key)) continue;
          seen.add(key);

          results.push({ ticker, date: dateIso, value, isManual: true });
        }

        pageCount += 1;
        if (json.hasMore && typeof json.lastValue === 'number') {
          lastValue = json.lastValue;
        } else {
          break;
        }
      }

      appLogger.info(SOURCE, `За ${year}: загружено страниц — ${pageCount}, всего записей в накоплении — ${results.length}`);
    }

    return results;
  }

  private static validateJson(text: string): boolean {
    if (!text) return false;
    try {
      const json = JSON.parse(text);
      return Array.isArray(json?.data);
    } catch {
      return false;
    }
  }

  private static parseDate(text?: string): string {
    if (!text) return '';
    const match = String(text).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) return '';
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  private static parseValue(value?: number | string): number {
    if (value === undefined || value === null || value === '') return 0;
    const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
    if (isNaN(num) || num <= 0 || num > 50000) return 0;
    return num;
  }
}
