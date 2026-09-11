import { IDividendHistory } from '../../types/domain';
import { appLogger } from '../logging/appLogger';

export type DividendFeedSource = 'smartlab' | 'bcs' | 'investmint';

export interface IDividendFeedRecord {
  ticker: string;
  date: string; // YYYY-MM-DD (дата закрытия реестра)
  value: number;
  source: DividendFeedSource;
}

export interface IDividendFeed {
  schemaVersion: number;
  generatedAt: string;
  records: IDividendFeedRecord[];
  errors?: string[];
}

const FEED_PATH = 'dividends/feed.json';

/**
 * Читает статический кэш дивидендов, который публикует GitHub Actions
 * вместе с приложением (см. scripts/fetch-dividends.mjs). Файл лежит на том же
 * домене (GitHub Pages), поэтому запрос не требует CORS-прокси и работает
 * даже в сетях, где публичные прокси заблокированы.
 */
export class DividendFeedService {
  static async fetchFeed(): Promise<IDividendFeed | null> {
    try {
      const base = import.meta.env.BASE_URL || '/';
      const url = `${base}${FEED_PATH}`;
      const resp = await fetch(url, { cache: 'no-cache' });
      if (!resp.ok) {
        appLogger.info('DividendFeed', `Кэш дивидендов недоступен (HTTP ${resp.status})`, url);
        return null;
      }
      const json = await resp.json();
      if (!json || !Array.isArray(json.records)) {
        appLogger.warn('DividendFeed', 'Кэш дивидендов имеет неожиданную структуру', url);
        return null;
      }
      return json as IDividendFeed;
    } catch (err: any) {
      appLogger.info('DividendFeed', 'Кэш дивидендов не прочитан (fallback на live-источники)', err?.message || String(err));
      return null;
    }
  }

  static bySource(feed: IDividendFeed, source: DividendFeedSource): IDividendHistory[] {
    return (feed.records || [])
      .filter(r => r.source === source && r.ticker && r.date && r.value > 0)
      .map(r => ({
        ticker: String(r.ticker).toUpperCase(),
        date: r.date,
        value: r.value,
        isManual: true,
      }));
  }
}
