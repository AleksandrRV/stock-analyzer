import { IDividendHistory } from '../../types/domain';
import { appLogger } from '../logging/appLogger';
import { fetchViaSources } from './httpSourceFetcher';

const SOURCE = 'SmartLab';

/**
 * Шлюз к Smart-Lab: источник резервной истории дивидендов.
 *
 * Smart-Lab не отдаёт заголовки CORS, поэтому загрузка идёт через общий
 * механизм fetchViaSources (свой прокси → прямой → публичные прокси, параллельно).
 *
 * Замечание о защите Smart-Lab (Qrator): в браузере заголовки User-Agent/Referer
 * задать нельзя (forbidden), реальный браузерный User-Agent уходит автоматически
 * и пробрасывается прокси, пересылающими клиентские заголовки (например, cors.eu.org).
 * Если публичные прокси заблокированы сетью — укажите свой прокси в Настройках.
 */
export class SmartLabGateway {
  static async fetchSmartLabDividends(year: number, customProxyUrl?: string): Promise<IDividendHistory[]> {
    const targetUrl = `https://smart-lab.ru/dividends/index?year=${year}`;

    let htmlText: string;
    try {
      const result = await fetchViaSources(targetUrl, {
        customProxyUrl,
        sourceName: SOURCE,
        headers: { Referer: 'https://smart-lab.ru/' },
        validate: html => /\bТикер\b/i.test(html) && /\bДивиденд/i.test(html) && /<table/i.test(html),
      });
      htmlText = result.text;
    } catch (err: any) {
      appLogger.error(SOURCE, `Не удалось загрузить дивиденды за ${year} со Smart-Lab. ${err?.message || err}`, targetUrl);
      throw new Error(
        `Smart-Lab (${year}): не удалось получить страницу. ${err?.message || ''}. ` +
        `Вероятно, публичные CORS-прокси заблокированы вашей сетью — укажите свой прокси в «Настройках».`,
      );
    }

    const rows = this.parseSmartLabHtml(htmlText);
    if (rows.length === 0) {
      appLogger.error(
        SOURCE,
        `Дивиденды за ${year}: страница получена, но строки таблицы не распознаны (0 записей)`,
        `Фрагмент HTML: ${htmlText.slice(0, 400)}`,
      );
      throw new Error(`Smart-Lab (${year}): страница получена, но дивиденды не распознаны (0 записей)`);
    }

    appLogger.info(SOURCE, `Дивиденды за ${year}: распознано записей — ${rows.length}`);
    return rows;
  }

  private static parseSmartLabHtml(htmlText: string): IDividendHistory[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const results: IDividendHistory[] = [];

    const rows = doc.querySelectorAll('table tr');

    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 3) return;

      // 1) Тикер: из ссылки /q/TICKER/ или /forum/TICKER, иначе из колонки «Тикер» (индекс 1)
      let ticker = '';
      const anchors = row.querySelectorAll('a');
      for (const a of Array.from(anchors)) {
        const href = a.getAttribute('href') || '';
        const match = href.match(/\/(?:q|forum)\/([A-Z0-9]{1,6})\b/i);
        if (match) {
          ticker = match[1].toUpperCase();
          break;
        }
      }
      if (!ticker) {
        const cellText = (cells[1]?.textContent || '').trim().toUpperCase();
        const match = cellText.match(/^([A-Z]{1,6})$/);
        if (match) ticker = match[1];
      }
      if (!ticker) return;

      // 2) Дата отсечки: колонка «Дата закрытия реестра» (индекс 7), иначе первая дата в строке
      let dateIso = this.extractDate(cells.length >= 8 ? (cells[7]?.textContent || '') : '');
      if (!dateIso) {
        dateIso = this.extractDate(row.textContent || '');
      }
      if (!dateIso) return;

      // 3) Размер дивиденда: колонка «Дивиденд, руб» (индекс 3), иначе первая подходящая ячейка
      let value = this.extractValue(cells.length >= 4 ? (cells[3]?.textContent || '') : '');
      if (!value) {
        for (const cell of cells) {
          value = this.extractValue(cell.textContent || '');
          if (value) break;
        }
      }

      if (ticker && dateIso && value > 0) {
        results.push({
          ticker,
          date: dateIso,
          value,
          isManual: true,
        });
      }
    });

    return results;
  }

  private static extractDate(text: string): string {
    if (!text) return '';
    const full = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (full) {
      const [, day, month, year] = full;
      return `${year}-${month}-${day}`;
    }
    const short = text.match(/(\d{2})\.(\d{2})\.(\d{2})\b/);
    if (short) {
      const [, day, month, yearShort] = short;
      return `20${yearShort}-${month}-${day}`;
    }
    return '';
  }

  private static extractValue(text: string): number {
    if (!text) return 0;
    const cleaned = text
      .replace(/\u00a0/g, ' ')
      .replace(/₽/g, '')
      .replace(/руб\.?/gi, '')
      .replace(/%/g, '')
      .replace(/\s+/g, '')
      .trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(cleaned)) return 0;
    const value = parseFloat(cleaned.replace(',', '.'));
    return isNaN(value) ? 0 : value;
  }
}
