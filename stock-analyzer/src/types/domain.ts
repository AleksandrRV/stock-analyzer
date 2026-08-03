export interface IStockSplit {
  ticker: string;
  date: string;
  coefficient: number;
}

export type ScreenOrientation = 'auto' | 'portrait' | 'landscape';

export interface IGlobalSettings {
  dividendTaxRate: number;
  tickerRenames: ITickerRename[];
  stockSplits?: IStockSplit[];
  orientation?: ScreenOrientation;
}

export interface ITickerRename {
  oldTicker: string;
  newTicker: string;
  changeDate: string;
}

export type AssetType = 'STOCK' | 'FUND';

export interface IAssetAllocation {
  ticker: string;
  weight: number;
  type: AssetType;
}

export interface IMilestone {
  id: string;
  date: string;
  assets: IAssetAllocation[];
}

export interface IPortfolio {
  id: string;
  groupId: string | null;
  name: string;
  createdAt: string;
  closedAt: string | null;
  milestones: IMilestone[];
}

export interface IPortfolioGroup {
  id: string;
  name: string;
  isArchive?: boolean;
}

export interface IPriceHistory {
  ticker: string;
  date: string;
  price: number;
  type?: AssetType | 'INDEX';
}

export interface IDividendHistory {
  ticker: string;
  date: string;
  value: number;
  isManual?: boolean;
}

export interface IExportData {
  schemaVersion: number;
  exportedAt: string;
  settings: IGlobalSettings;
  groups: IPortfolioGroup[];
  portfolios: IPortfolio[];
}