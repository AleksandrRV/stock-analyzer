import { AssetType, IGlobalSettings } from '../../types/domain';
import { TickerResolver } from '../../engine/TickerResolver';
import { DateTimeStandardizer } from '../../engine/DateTimeStandardizer';
import { MarketDataSyncService } from '../sync/MarketDataSyncService';
import { MoexApiGateway } from '../api/MoexApiGateway';

export type AssetCheckStatus = 'PENDING' | 'OK' | 'UNKNOWN_TICKER' | 'NO_PRICE_ON_DATE' | 'UNVERIFIED';

export interface IAssetCheckResult {
  ticker: string;
  resolvedTicker: string;
  dateKey: string;
  status: AssetCheckStatus;
  price: number | null;
  tradeDate: string | null;
}

const existenceCache = new Map<string, boolean>();

export class MilestoneAssetVerifier {
  static createPendingResult(rawTicker: string, targetUtcIso: string): IAssetCheckResult {
    const ticker = rawTicker.trim().toUpperCase();
    return {
      ticker,
      resolvedTicker: ticker,
      dateKey: this.buildDateKey(targetUtcIso),
      status: 'PENDING',
      price: null,
      tradeDate: null,
    };
  }

  static buildDateKey(targetUtcIso: string): string {
    if (!targetUtcIso) return '';
    return DateTimeStandardizer.toMSKDateString(targetUtcIso);
  }

  static async verifyAsset(
    rawTicker: string,
    assetType: AssetType,
    targetUtcIso: string,
    settings: IGlobalSettings
  ): Promise<IAssetCheckResult> {
    const ticker = rawTicker.trim().toUpperCase();
    const resolvedTicker = TickerResolver.resolveTicker(ticker, targetUtcIso, settings.tickerRenames || []);
    const dateKey = this.buildDateKey(targetUtcIso);
    const base = { ticker, resolvedTicker, dateKey };

    const priceResult = await MarketDataSyncService.getOrFetchPrice(resolvedTicker, targetUtcIso, assetType);
    if (priceResult && priceResult.price > 0) {
      return { ...base, status: 'OK', price: priceResult.price, tradeDate: priceResult.actualTradeDate };
    }

    if (!navigator.onLine) {
      return { ...base, status: 'UNVERIFIED', price: null, tradeDate: null };
    }

    const exists = await this.checkExistence(resolvedTicker);
    if (exists === false) {
      return { ...base, status: 'UNKNOWN_TICKER', price: null, tradeDate: null };
    }
    if (exists === null) {
      return { ...base, status: 'UNVERIFIED', price: null, tradeDate: null };
    }

    return { ...base, status: 'NO_PRICE_ON_DATE', price: null, tradeDate: null };
  }

  private static async checkExistence(ticker: string): Promise<boolean | null> {
    const cached = existenceCache.get(ticker);
    if (cached !== undefined) return cached;

    const exists = await MoexApiGateway.fetchSecurityExists(ticker);
    if (exists !== null) existenceCache.set(ticker, exists);
    return exists;
  }
}
