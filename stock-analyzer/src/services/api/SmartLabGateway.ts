import { IDividendHistory } from '../../types/domain';
import { appLogger } from '../logging/appLogger';

const SOURCE = 'SmartLab';
const REQUEST_TIMEOUT_MS = 12000;

interface IAttempt {
  label: string;
  url: string;
  extract: (resp: Response) => Promise<string>;
}

interface IAttemptResult {
  ok: boolean;
  html?: string;
}

/**
 * Шлюз к Smart-Lab: источник резервной истории дивидендов.
 *
 * Smart-Lab не отдаёт заголовки CORS, поэтому прямой запрос из браузера
 * блокируется. Загрузка идёт по нескольким независимым источникам
 * (свой прокси → прямой → cors.eu.org → allorigins → codetabs) ПАРАЛЛЕЛЬНО:
 * побеждает первый, кто вернул валидную страницу. Это устойчивее к блокировке
 * отдельных публичных прокси и к медленной сети.
 *
 * Каждая попытка подробно логируется через appLogger (URL, статус, ошибка),
 * чтобы сбой можно было диагностировать в «Настройки → Логи».
 */
export class SmartLabGateway {
  static async fetchSmartLabDividends(year: number, customProxyUrl?: string): Promise<IDividendHistory[]> {
    const targetUrl = `https://smart-lab.ru/dividends/index?year=${year}`;
    const attempts = this.buildAttempts(targetUrl, customProxyUrl);

    const failures: string[] = [];
    let settled = false;

    const tryAttempt = async (attempt: IAttempt): Promise<IAttemptResult> => {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const resp = await fetch(attempt.url, { signal: controller.signal, cache: 'no-cache' });
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startedAt;

        if (settled) return { ok: false };

        if (!resp.ok) {
          const errMsg = `HTTP ${resp.status} ${resp.statusText}`;
          appLogger.warn(SOURCE, `${attempt.label}: ошибка запроса — ${errMsg} (${durationMs} мс)`, attempt.url);
          failures.push(`${attempt.label}: ${errMsg}`);
          return { ok: false };
        }

        const text = await attempt.extract(resp);
        if (!this.looksLikeDividendsHtml(text)) {
          appLogger.warn(
            SOURCE,
            `${attempt.label}: получен ответ, не похожий на страницу дивидендов (${text.length} симв.)`,
            attempt.url,
          );
          failures.push(`${attempt.label}: ответ не похож на страницу дивидендов`);
          return { ok: false };
        }

        appLogger.success(
          SOURCE,
          `Дивиденды за ${year}: страница получена через «${attempt.label}» (${text.length} симв., ${durationMs} мс)`,
          attempt.url,
        );
        return { ok: true, html: text };
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (settled) return { ok: false };
        const durationMs = Date.now() - startedAt;
        const reason = err?.name === 'AbortError'
          ? `таймаут запроса (${REQUEST_TIMEOUT_MS / 1000} c)`
          : (err?.message || String(err));
        appLogger.warn(SOURCE, `${attempt.label}: запрос не выполнен — ${reason} (${durationMs} мс)`, attempt.url);
        failures.push(`${attempt.label}: ${reason}`);
        return { ok: false };
      }
    };

    // Первый успешный ответ побеждает; остальные запросы игнорируются.
    const htmlText = await new Promise<string | null>(resolve => {
      if (attempts.length === 0) {
        settled = true;
        resolve(null);
        return;
      }
      let remaining = attempts.length;
      const finish = (html: string | null) => {
        if (settled) return;
        settled = true;
        resolve(html);
      };

      attempts.forEach(attempt => {
        tryAttempt(attempt)
          .then(res => {
            if (settled) return;
            if (res.ok && res.html) {
              finish(res.html);
            } else {
              remaining -= 1;
              if (remaining === 0) finish(null);
            }
          })
          .catch(() => {
            if (settled) return;
            remaining -= 1;
            if (remaining === 0) finish(null);
          });
      });
    });

    if (!htmlText) {
      const summary = failures.length > 0
        ? `Попытки: ${failures.join(' | ')}`
        : 'Нет доступных источников';
      appLogger.error(SOURCE, `Не удалось загрузить дивиденды за ${year} со Smart-Lab. ${summary}`, targetUrl);
      throw new Error(
        `Smart-Lab (${year}): не удалось получить страницу. ${summary}. ` +
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

  private static buildAttempts(targetUrl: string, customProxyUrl?: string): IAttempt[] {
    const attempts: IAttempt[] = [];

    const custom = customProxyUrl ? this.buildProxyUrl(customProxyUrl, targetUrl) : '';
    if (custom) {
      attempts.push({ label: 'Свой прокси', url: custom, extract: async resp => resp.text() });
    }

    attempts.push({ label: 'Прямой запрос', url: targetUrl, extract: async resp => resp.text() });

    attempts.push({
      label: 'cors.eu.org',
      url: `https://cors.eu.org/${targetUrl}`,
      extract: async resp => resp.text(),
    });

    attempts.push({
      label: 'allorigins /get',
      url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
      extract: async resp => {
        const json = await resp.json();
        if (json && typeof json.contents === 'string' && json.contents.length > 0) {
          return json.contents;
        }
        throw new Error('В ответе allorigins отсутствует поле contents');
      },
    });

    attempts.push({
      label: 'allorigins /raw',
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      extract: async resp => resp.text(),
    });

    attempts.push({
      label: 'codetabs proxy',
      url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
      extract: async resp => resp.text(),
    });

    return attempts;
  }

  /**
   * Собирает URL своего прокси. Поддерживаются два формата:
   *  - префикс:        https://cors.eu.org/            → https://cors.eu.org/<target>
   *  - шаблон {url}:   https://host/proxy?url={url}    → {url} заменяется на закодированный адрес
   */
  private static buildProxyUrl(base: string, target: string): string {
    const trimmed = base.trim();
    if (!trimmed) return '';
    if (trimmed.includes('{url}')) {
      return trimmed.replace('{url}', encodeURIComponent(target));
    }
    return `${trimmed.replace(/\/+$/, '')}/${target}`;
  }

  /** Проверяем, что полученный HTML действительно страница дивидендов Smart-Lab. */
  private static looksLikeDividendsHtml(html: string): boolean {
    if (!html || html.trim().length < 500) return false;
    return /\bТикер\b/i.test(html) && /\bДивиденд/i.test(html) && /<table/i.test(html);
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
