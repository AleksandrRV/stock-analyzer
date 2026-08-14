import { AssetType } from '../types/domain';
import { IMoexAsset, MOEX_ASSET_CATALOG, findCatalogAsset } from '../constants/assets';

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

interface IAssetIndexEntry {
  asset: IMoexAsset;
  tickerKey: string;
  labelKeys: string[];
}

export interface ITickerSuggestion {
  ticker: string;
  name: string;
  type: AssetType;
  score: number;
}

export interface IResolvedTickerInput {
  ticker: string;
  type: AssetType;
  isKnown: boolean;
}

let searchIndex: IAssetIndexEntry[] | null = null;

const buildIndex = (): IAssetIndexEntry[] => {
  if (searchIndex) return searchIndex;

  searchIndex = MOEX_ASSET_CATALOG.map(asset => {
    const labels = [asset.name, ...(asset.aliases || [])];
    const labelKeys = labels
      .map(label => TickerSearch.normalize(label))
      .filter(key => key.length > 0);

    return {
      asset,
      tickerKey: TickerSearch.normalize(asset.ticker),
      labelKeys: Array.from(new Set(labelKeys)),
    };
  });

  return searchIndex;
};

const scoreEntry = (entry: IAssetIndexEntry, queryKey: string): number => {
  if (entry.tickerKey === queryKey) return 0;
  if (entry.tickerKey.startsWith(queryKey)) return 1;

  for (const labelKey of entry.labelKeys) {
    if (labelKey === queryKey) return 2;
  }
  for (const labelKey of entry.labelKeys) {
    if (labelKey.startsWith(queryKey)) return 3;
  }
  if (entry.tickerKey.includes(queryKey)) return 4;
  for (const labelKey of entry.labelKeys) {
    if (labelKey.includes(queryKey)) return 5;
  }
  return -1;
};

export class TickerSearch {
  static normalize(input: string): string {
    const lowered = (input || '').toLowerCase();
    let result = '';

    for (const char of lowered) {
      const translit = CYRILLIC_TO_LATIN[char];
      if (translit !== undefined) {
        result += translit;
        continue;
      }
      if (char >= 'a' && char <= 'z') result += char;
      else if (char >= '0' && char <= '9') result += char;
    }
    return result;
  }

  static search(query: string, limit = 8): ITickerSuggestion[] {
    const queryKey = this.normalize(query);
    if (!queryKey) return [];

    const matches: ITickerSuggestion[] = [];

    for (const entry of buildIndex()) {
      const score = scoreEntry(entry, queryKey);
      if (score < 0) continue;
      matches.push({
        ticker: entry.asset.ticker,
        name: entry.asset.name,
        type: entry.asset.type,
        score,
      });
    }

    matches.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.ticker.length !== b.ticker.length) return a.ticker.length - b.ticker.length;
      return a.ticker.localeCompare(b.ticker);
    });

    return matches.slice(0, limit);
  }

  static resolveInput(input: string, fallbackType: AssetType = 'STOCK'): IResolvedTickerInput | null {
    const raw = (input || '').trim();
    if (!raw) return null;

    const directHit = findCatalogAsset(raw);
    if (directHit) {
      return { ticker: directHit.ticker, type: directHit.type, isKnown: true };
    }

    const best = this.search(raw, 1)[0];
    if (best && best.score <= 3) {
      return { ticker: best.ticker, type: best.type, isKnown: true };
    }

    const looksLikeTicker = /^[A-Za-z0-9]{1,12}$/.test(raw);
    if (looksLikeTicker) {
      return { ticker: raw.toUpperCase(), type: fallbackType, isKnown: false };
    }

    return null;
  }
}
