export interface IStockSplit {
  ticker: string;
  date: string; // ISO 8601 UTC
  coefficient: number; // New Shares / Old Shares
}

export interface IGlobalSettings {
  dividendTaxRate: number; // по умолчанию 15%
  tickerRenames: ITickerRename[];
  stockSplits?: IStockSplit[];
}

export interface ITickerRename {
  oldTicker: string;
  newTicker: string;
  changeDate: string; // ISO 8601 UTC
}

export type AssetType = 'STOCK' | 'FUND';

export interface IAssetAllocation {
  ticker: string;
  weight: number;
  type: AssetType;
}

export interface IMilestone {
  id: string;
  date: string; // ISO 8601 UTC
  assets: IAssetAllocation[];
}

export interface IPortfolio {
  id: string;
  groupId: string | null;
  name: string;
  createdAt: string; // ISO 8601 UTC
  closedAt: string | null; // ISO 8601 UTC или null
  milestones: IMilestone[];
}

export interface IPortfolioGroup {
  id: string;
  name: string;
  isArchive?: boolean;
}

export interface IPriceHistory {
  ticker: string;
  date: string; // YYYY-MM-DD
  price: number;
  type?: AssetType | 'INDEX'; // НОВОЕ ПОЛЕ: для точной очистки IndexedDB
}

export interface IDividendHistory {
  ticker: string;
  date: string; // YYYY-MM-DD (дата отсечки)
  value: number; // Грязный дивиденд на 1 акцию
  isManual?: boolean; // Флаг: внесен вручную
}

export interface IExportData {
  schemaVersion: number;
  exportedAt: string;
  settings: IGlobalSettings;
  groups: IPortfolioGroup[];
  portfolios: IPortfolio[];
}