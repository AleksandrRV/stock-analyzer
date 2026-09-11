import { IDividendHistory } from '../../types/domain';
import { appLogger } from '../logging/appLogger';
import { fetchViaSources } from './httpSourceFetcher';

const SOURCE = 'Investmint';
const PAGE_URL = 'https://investmint.ru/past-dividends/';

const RU_MONTHS: Record<string, string> = {
  'янв': '01', 'января': '01',
  'фев': '02', 'февраля': '02',
  'мар': '03', 'марта': '03',
  'апр': '04', 'апреля': '04',
  'май': '05', 'мая': '05',
  'июн': '06', 'июня': '06',
  'июл': '07', 'июля': '07',
  'авг': '08', 'августа': '08',
  'сен': '09', 'сентября': '09',
  'окт': '10', 'октября': '10',
  'ноя': '11', 'ноября': '11',
  'дек': '12', 'декабря': '12',
};

/**
 * Шлюз к Investmint (https://investmint.ru/past-dividends/):
 * таблица прошедших дивидендов текущего года, отдаётся сервером в HTML.
 */
export class InvestmintGateway {
  static async fetchPastDividends(customProxyUrl?: string): Promise<IDividendHistory[]> {
    appLogger.info(SOURCE, 'Загрузка прошедших дивидендов', PAGE_URL);

    const { text } = await fetchViaSources(PAGE_URL, {
      customProxyUrl,
      sourceName: SOURCE,
      headers: { Referer: 'https://investmint.ru/' },
      validate: html => /\bРеестр\b/i.test(html) && /\bДивиденды\b/i.test(html) && /<table/i.test(html),
    });

    const rows = this.parseHtml(text);
    if (rows.length === 0) {
      appLogger.error(SOURCE, 'Страница получена, но строки таблицы не распознаны (0 записей)', `Фрагмент: ${text.slice(0, 400)}`);
      throw new Error('Investmint: страница получена, но дивиденды не распознаны (0 записей)');
    }

    appLogger.info(SOURCE, `Распознано записей — ${rows.length}`);
    return rows;
  }

  private static parseHtml(htmlText: string): IDividendHistory[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const results: IDividendHistory[] = [];

    const rows = doc.querySelectorAll('table tr');
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 3) return;

      const ticker = this.extractTicker(cells[0]);
      const dateIso = this.parseDate((cells[1]?.textContent || '').trim());
      const value = this.parseValue(cells[2]?.textContent || '');

      if (!ticker || !dateIso || !value) return;

      results.push({
        ticker,
        date: dateIso,
        value,
        isManual: true,
      });
    });

    return results;
  }

  /** Тикер — последний «заглавный» латинский токен в ячейке «Акция» (напр. «Акрон AKRN» → AKRN). */
  private static extractTicker(cell: Element): string {
    const linkText = cell.querySelector('a')?.textContent || cell.textContent || '';
    const matches = linkText.match(/[A-Z]{1,6}/g);
    if (matches && matches.length > 0) {
      return matches[matches.length - 1];
    }
    // Фоллбэк: слаг из href вида /ticker/ или /ticker/divs/
    const href = cell.querySelector('a')?.getAttribute('href') || '';
    const slugMatch = href.match(/\/([a-z0-9]{1,8})\/(?:divs\/)?$/i);
    return slugMatch ? slugMatch[1].toUpperCase() : '';
  }

  private static parseDate(text: string): string {
    const match = text.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
    if (!match) return '';
    const [, day, monthRaw, year] = match;
    const month = RU_MONTHS[monthRaw.toLowerCase()];
    if (!month) return '';
    return `${year}-${month}-${String(Number(day)).padStart(2, '0')}`;
  }

  private static parseValue(text: string): number {
    if (!text) return 0;
    const cleaned = text
      .replace(/\u00a0/g, ' ')
      .replace(/₽/g, '')
      .replace(/руб\.?/gi, '')
      .replace(/\s+/g, '')
      .trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(cleaned)) return 0;
    const value = parseFloat(cleaned.replace(',', '.'));
    return isNaN(value) ? 0 : value;
  }
}
