// Группа портфелей (Папка)
export interface IPortfolioGroup {
  id: string;
  name: string;
  isArchive?: boolean;
}

// Глобальные настройки приложения
export interface IGlobalSettings {
  dividendTaxRate: number; // по умолчанию 15%
  tickerRenames: ITickerRename[];
}

// Переименование тикера
export interface ITickerRename {
  oldTicker: string;
  newTicker: string;
  changeDate: string; // ISO 8601 UTC
}

// Тип актива в портфеле
export type AssetType = 'STOCK' | 'FUND';

// Актив внутри контрольной точки
export interface IAssetAllocation {
  ticker: string;
  weight: number; // В процентах (от 0 до 100)
  type: AssetType;
}

// Контрольная точка (Milestone)
export interface IMilestone {
  id: string;
  date: string; // ISO 8601 UTC
  assets: IAssetAllocation[];
}

// Портфель
export interface IPortfolio {
  id: string;
  groupId: string | null; // null = базовая группа
  name: string;
  createdAt: string; // ISO 8601 UTC
  closedAt: string | null; // ISO 8601 UTC или null
  milestones: IMilestone[];
}

// Запись цены в IndexedDB
export interface IPriceHistory {
  id?: number;
  ticker: string;
  date: string; // YYYY-MM-DD
  price: number;
}

// Запись дивиденда в IndexedDB
export interface IDividendHistory {
  id?: number;
  ticker: string;
  date: string; // YYYY-MM-DD
  value: number;
}

// Структура файла бэкапа JSON
export interface IExportData {
  schemaVersion: number; // Версия схемы (1)
  exportedAt: string;    // ISO дата экспортного файла
  settings: IGlobalSettings;
  groups: IPortfolioGroup[];
  portfolios: IPortfolio[];
}