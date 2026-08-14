import { FALLBACK_QUICK_TICKERS } from '../../constants/assets';

const RECENT_TICKERS_KEY = 'app_recent_tickers';
const RECENT_LIMIT = 10;
const QUICK_ACCESS_SIZE = 10;

export class RecentTickersStorage {
  static getRecent(): string[] {
    try {
      const raw = localStorage.getItem(RECENT_TICKERS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map(item => item.trim().toUpperCase())
        .slice(0, RECENT_LIMIT);
    } catch {
      return [];
    }
  }

  static remember(ticker: string): void {
    const clean = (ticker || '').trim().toUpperCase();
    if (!clean) return;

    const updated = [clean, ...this.getRecent().filter(item => item !== clean)].slice(0, RECENT_LIMIT);
    try {
      localStorage.setItem(RECENT_TICKERS_KEY, JSON.stringify(updated));
    } catch {
      return;
    }
  }

  static getQuickAccess(): string[] {
    const recent = this.getRecent();
    const merged = [...recent];

    for (const ticker of FALLBACK_QUICK_TICKERS) {
      if (merged.length >= QUICK_ACCESS_SIZE) break;
      if (!merged.includes(ticker)) merged.push(ticker);
    }

    return merged.slice(0, QUICK_ACCESS_SIZE).sort((a, b) => a.localeCompare(b));
  }
}
