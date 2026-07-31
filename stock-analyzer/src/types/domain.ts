// Данные о сплите/консолидации
export interface IStockSplit {
  ticker: string;
  date: string; // ISO 8601 UTC (Дата, когда торги пошли по новой цене)
  coefficient: number; // New Shares / Old Shares. (Сплит 1 к 100 = 100. Консолидация 5000 к 1 = 0.0002)
}

// Глобальные настройки приложения
export interface IGlobalSettings {
  dividendTaxRate: number; // по умолчанию 15%
  tickerRenames: ITickerRename[];
  stockSplits?: IStockSplit[]; // Пользовательские сплиты
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
  date: string; // ISO 8601 UTC (часы зафиксированы, минуты=00, секунды=00)
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

// Группа портфелей (Папка)
export interface IPortfolioGroup {
  id: string;
  name: string;
  isArchive?: boolean;
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
  date: string; // YYYY-MM-DD (дата отсечки)
  value: number; // Грязный дивиденд на 1 акцию
  isManual?: boolean; // Флаг: внесен вручную пользователем
}

// Структура файла бэкапа JSON
export interface IExportData {
  schemaVersion: number;
  exportedAt: string;
  settings: IGlobalSettings;
  groups: IPortfolioGroup[];
  portfolios: IPortfolio[];
}