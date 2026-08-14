import { IMoexAsset } from './assetCatalogTypes';
import { MOEX_STOCKS } from './moexStocks';
import { MOEX_FUNDS } from './moexFunds';

export type { IMoexAsset };
export { MOEX_STOCKS, MOEX_FUNDS };

export const MOEX_ASSET_CATALOG: IMoexAsset[] = [...MOEX_STOCKS, ...MOEX_FUNDS]
  .sort((a, b) => a.ticker.localeCompare(b.ticker));

export const FALLBACK_QUICK_TICKERS: string[] = [
  'SBER', 'GAZP', 'LKOH', 'T', 'YDEX', 'GMKN', 'ROSN', 'NVTK', 'X5', 'LQDT',
];

const CATALOG_BY_TICKER: Map<string, IMoexAsset> = new Map(
  MOEX_ASSET_CATALOG.map(asset => [asset.ticker, asset])
);

export const findCatalogAsset = (ticker: string): IMoexAsset | undefined => {
  return CATALOG_BY_TICKER.get(ticker.trim().toUpperCase());
};
