import { create } from 'zustand';
import { IPortfolio, IPortfolioGroup, IMilestone, IGlobalSettings, IExportData, ITickerRename, IStockSplit } from '../types/domain';
import { UserStorage, DEFAULT_SETTINGS } from '../services/storage/userStorage';
import { ICalculatedPortfolio, IMonthlyMatrixRow } from '../services/engine/PortfolioCalculationService';

const GROUPS_STORAGE_KEY = 'app_user_groups';

export interface ICachedCalculation {
  calculatedAtHour: number;
  result: ICalculatedPortfolio;
}

export interface ICachedMatrix {
  calculatedAtHour: number;
  result: IMonthlyMatrixRow[];
}

export type OpenPortfolioMode = 'default' | 'analytics';

interface PortfolioState {
  portfolios: IPortfolio[];
  groups: IPortfolioGroup[];
  settings: IGlobalSettings;
  activeGroupId: string | null;
  
  selectedPortfolioId: string | null;
  openPortfolioMode: OpenPortfolioMode;
  
  calculationsCache: Record<string, ICachedCalculation>;
  matrixCache: Record<string, ICachedMatrix>;
  
  setCalculationCache: (portfolioId: string, calcResult: ICalculatedPortfolio, currentHour: number) => void;
  setMatrixCache: (portfolioId: string, matrixResult: IMonthlyMatrixRow[], currentHour: number) => void;
  clearCalculationCache: (portfolioId?: string) => void;

  loadFromStorage: () => void;
  openPortfolio: (id: string | null, mode?: OpenPortfolioMode) => void;
  
  updateSettings: (newSettings: Partial<IGlobalSettings>) => void;
  addCustomTickerRename: (rename: ITickerRename) => void;
  removeCustomTickerRename: (oldTicker: string) => void;
  addCustomSplit: (split: IStockSplit) => void;
  removeCustomSplit: (ticker: string) => void;

  restoreFullData: (data: IExportData) => void;
  
  createPortfolio: (name: string, groupId?: string | null) => IPortfolio;
  renamePortfolio: (id: string, newName: string) => void;
  deletePortfolio: (id: string) => void;
  movePortfolioToGroup: (portfolioId: string, targetGroupId: string | null) => void;
  closePortfolio: (portfolioId: string, closedAtIso: string | null) => void;
  
  addMilestone: (portfolioId: string, milestone: IMilestone) => void;
  updateMilestone: (portfolioId: string, milestone: IMilestone) => void;
  deleteMilestone: (portfolioId: string, milestoneId: string) => void;
  
  createGroup: (name: string) => void;
  deleteGroup: (groupId: string) => void;
  setActiveGroupId: (groupId: string | null) => void;

  getVisiblePortfolios: () => IPortfolio[];
  getSelectedPortfolio: () => IPortfolio | undefined;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  portfolios: [],
  groups: [],
  settings: { ...DEFAULT_SETTINGS, orientation: 'auto' },
  activeGroupId: null,
  selectedPortfolioId: null,
  openPortfolioMode: 'default',
  
  calculationsCache: {},
  matrixCache: {},

  setCalculationCache: (portfolioId, calcResult, currentHour) => {
    set(state => ({
      calculationsCache: { ...state.calculationsCache, [portfolioId]: { calculatedAtHour: currentHour, result: calcResult } }
    }));
  },

  setMatrixCache: (portfolioId, matrixResult, currentHour) => {
    set(state => ({
      matrixCache: { ...state.matrixCache, [portfolioId]: { calculatedAtHour: currentHour, result: matrixResult } }
    }));
  },

  clearCalculationCache: (portfolioId) => {
    if (portfolioId) {
      set(state => {
        const newCalc = { ...state.calculationsCache };
        const newMatrix = { ...state.matrixCache };
        delete newCalc[portfolioId];
        delete newMatrix[portfolioId];
        return { calculationsCache: newCalc, matrixCache: newMatrix };
      });
    } else {
      set({ calculationsCache: {}, matrixCache: {} });
    }
  },

  loadFromStorage: () => {
    const portfolios = UserStorage.getPortfolios();
    const settings = UserStorage.getSettings();
    const savedGroups = localStorage.getItem(GROUPS_STORAGE_KEY);
    const groups: IPortfolioGroup[] = savedGroups ? JSON.parse(savedGroups) : [];
    
    set({ portfolios, groups, settings });
  },

  openPortfolio: (id, mode = 'default') => set({ selectedPortfolioId: id, openPortfolioMode: mode }),

  setActiveGroupId: (groupId) => set({ activeGroupId: groupId }),

  updateSettings: (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    set({ settings: updated });
    UserStorage.saveSettings(updated);
    get().clearCalculationCache();
  },

  addCustomTickerRename: (rename) => {
    const currentRenames = get().settings.tickerRenames || [];
    const filtered = currentRenames.filter(r => r.oldTicker !== rename.oldTicker);
    const updatedRenames = [...filtered, rename];
    get().updateSettings({ tickerRenames: updatedRenames });
  },

  removeCustomTickerRename: (oldTicker) => {
    const currentRenames = get().settings.tickerRenames || [];
    const updatedRenames = currentRenames.filter(r => r.oldTicker !== oldTicker);
    get().updateSettings({ tickerRenames: updatedRenames });
  },

  addCustomSplit: (split) => {
    const currentSplits = get().settings.stockSplits || [];
    const filtered = currentSplits.filter(s => s.ticker !== split.ticker);
    const updatedSplits = [...filtered, split];
    get().updateSettings({ stockSplits: updatedSplits });
  },

  removeCustomSplit: (ticker) => {
    const currentSplits = get().settings.stockSplits || [];
    const updatedSplits = currentSplits.filter(s => s.ticker !== ticker);
    get().updateSettings({ stockSplits: updatedSplits });
  },

  restoreFullData: (data) => {
    const safeSettings: IGlobalSettings = {
      ...DEFAULT_SETTINGS,
      ...data.settings,
      tickerRenames: data.settings?.tickerRenames || [],
      stockSplits: data.settings?.stockSplits || [],
      orientation: data.settings?.orientation || 'auto',
    };

    set({
      settings: safeSettings,
      groups: data.groups || [],
      portfolios: data.portfolios || [],
      selectedPortfolioId: null,
      activeGroupId: null,
    });

    UserStorage.saveSettings(safeSettings);
    UserStorage.savePortfolios(data.portfolios || []);
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(data.groups || []));
    get().clearCalculationCache();
  },

  createPortfolio: (name, groupId = null) => {
    const newPortfolio: IPortfolio = {
      id: `port_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      groupId: groupId ?? get().activeGroupId,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      closedAt: null,
      milestones: [],
    };
    const updated = [newPortfolio, ...get().portfolios];
    set({ portfolios: updated });
    UserStorage.savePortfolios(updated);
    return newPortfolio;
  },

  renamePortfolio: (id, newName) => {
    const updated = get().portfolios.map(p => 
      p.id === id ? { ...p, name: newName.trim() } : p
    );
    set({ portfolios: updated });
    UserStorage.savePortfolios(updated);
  },

  deletePortfolio: (id) => {
    const updated = get().portfolios.filter(p => p.id !== id);
    set({ portfolios: updated, selectedPortfolioId: get().selectedPortfolioId === id ? null : get().selectedPortfolioId });
    UserStorage.savePortfolios(updated);
    get().clearCalculationCache(id);
  },

  movePortfolioToGroup: (portfolioId, targetGroupId) => {
    const updated = get().portfolios.map(p => 
      p.id === portfolioId ? { ...p, groupId: targetGroupId } : p
    );
    set({ portfolios: updated });
    UserStorage.savePortfolios(updated);
  },

  closePortfolio: (portfolioId, closedAtIso) => {
    const updated = get().portfolios.map(p => 
      p.id === portfolioId ? { ...p, closedAt: closedAtIso } : p
    );
    set({ portfolios: updated });
    UserStorage.savePortfolios(updated);
    get().clearCalculationCache(portfolioId);
  },

  addMilestone: (portfolioId, milestone) => {
    const updated = get().portfolios.map(p => {
      if (p.id !== portfolioId) return p;
      const newMilestones = [...p.milestones, milestone].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      return { ...p, milestones: newMilestones };
    });
    set({ portfolios: updated });
    UserStorage.savePortfolios(updated);
    get().clearCalculationCache(portfolioId);
  },

  updateMilestone: (portfolioId, updatedMilestone) => {
    const updated = get().portfolios.map(p => {
      if (p.id !== portfolioId) return p;
      const newMilestones = p.milestones
        .map(m => (m.id === updatedMilestone.id ? updatedMilestone : m))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return { ...p, milestones: newMilestones };
    });
    set({ portfolios: updated });
    UserStorage.savePortfolios(updated);
    get().clearCalculationCache(portfolioId);
  },

  deleteMilestone: (portfolioId, milestoneId) => {
    const updated = get().portfolios.map(p => {
      if (p.id !== portfolioId) return p;
      return { ...p, milestones: p.milestones.filter(m => m.id !== milestoneId) };
    });
    set({ portfolios: updated });
    UserStorage.savePortfolios(updated);
    get().clearCalculationCache(portfolioId);
  },

  createGroup: (name) => {
    const newGroup: IPortfolioGroup = {
      id: `group_${Date.now()}`,
      name: name.trim(),
    };
    const updated = [...get().groups, newGroup];
    set({ groups: updated });
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(updated));
  },

  deleteGroup: (groupId) => {
    const updatedPortfolios = get().portfolios.map(p => 
      p.groupId === groupId ? { ...p, groupId: null } : p
    );
    const updatedGroups = get().groups.filter(g => g.id !== groupId);

    set({ 
      groups: updatedGroups, 
      portfolios: updatedPortfolios,
      activeGroupId: get().activeGroupId === groupId ? null : get().activeGroupId 
    });

    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(updatedGroups));
    UserStorage.savePortfolios(updatedPortfolios);
  },

  getVisiblePortfolios: () => {
    const { portfolios, activeGroupId } = get();
    return portfolios.filter(p => {
      const pGroup = (!p.groupId || p.groupId === 'NO GROUP' || p.groupId === 'NO_GROUP') ? null : p.groupId;
      return pGroup === activeGroupId;
    });
  },

  getSelectedPortfolio: () => {
    const { portfolios, selectedPortfolioId } = get();
    return portfolios.find(p => p.id === selectedPortfolioId);
  },
}));