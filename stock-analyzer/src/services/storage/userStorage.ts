import { IGlobalSettings, IPortfolio } from '../../types/domain';

const SETTINGS_KEY = 'app_global_settings';
const PORTFOLIOS_KEY = 'app_user_portfolios';

export const DEFAULT_SETTINGS: IGlobalSettings = {
  dividendTaxRate: 15,
  tickerRenames: [],
  orientation: 'auto',
};

export class UserStorage {
  static getSettings(): IGlobalSettings {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : DEFAULT_SETTINGS;
  }

  static saveSettings(settings: IGlobalSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  static getPortfolios(): IPortfolio[] {
    const data = localStorage.getItem(PORTFOLIOS_KEY);
    return data ? JSON.parse(data) : [];
  }

  static savePortfolios(portfolios: IPortfolio[]): void {
    localStorage.setItem(PORTFOLIOS_KEY, JSON.stringify(portfolios));
  }
}
