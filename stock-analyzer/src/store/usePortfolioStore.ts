import { create } from 'zustand';
import { IPortfolio, IPortfolioGroup, IMilestone, IGlobalSettings, IExportData, ITickerRename } from '../types/domain';
import { UserStorage, DEFAULT_SETTINGS } from '../services/storage/userStorage';

const GROUPS_STORAGE_KEY = 'app_user_groups';

interface PortfolioState {
  portfolios: IPortfolio[];
  groups: IPortfolioGroup[];
  settings: IGlobalSettings;
  activeGroupId: string | null;
  selectedPortfolioId: string | null;
  
  // Загрузка
  loadFromStorage: () => void;
  setSelectedPortfolioId: (id: string | null) => void;
  
  // Настройки
  updateSettings: (newSettings: Partial<IGlobalSettings>) => void;
  addCustomTickerRename: (rename: ITickerRename) => void;
  removeCustomTickerRename: (oldTicker: string) => void;

  // Полное восстановление (Импорт)
  restoreFullData: (data: IExportData) => void;
  
  // Действия с портфелями
  createPortfolio: (name: string, groupId?: string | null) => IPortfolio;
  renamePortfolio: (id: string, newName: string) => void;
  deletePortfolio: (id: string) => void;
  movePortfolioToGroup: (portfolioId: string, targetGroupId: string | null) => void;
  closePortfolio: (portfolioId: string, closedAtIso: string | null) => void;
  
  // Контрольные точки
  addMilestone: (portfolioId: string, milestone: IMilestone) => void;
  updateMilestone: (portfolioId: string, milestone: IMilestone) => void;
  deleteMilestone: (portfolioId: string, milestoneId: string) => void;
  
  // Группы
  createGroup: (name: string) => void;
  deleteGroup: (groupId: string) => void;
  setActiveGroupId: (groupId: string | null) => void;

  // Селекторы
  getVisiblePortfolios: () => IPortfolio[];
  getSelectedPortfolio: () => IPortfolio | undefined;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  portfolios: [],
  groups: [],
  settings: DEFAULT_SETTINGS,
  activeGroupId: null,
  selectedPortfolioId: null,

  loadFromStorage: () => {
    const portfolios = UserStorage.getPortfolios();
    const settings = UserStorage.getSettings();
    const savedGroups = localStorage.getItem(GROUPS_STORAGE_KEY);
    const groups: IPortfolioGroup[] = savedGroups ? JSON.parse(savedGroups) : [];
    
    set({ portfolios, groups, settings });
  },

  setSelectedPortfolioId: (id) => set({ selectedPortfolioId: id }),

  setActiveGroupId: (groupId) => set({ activeGroupId: groupId }),

  updateSettings: (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    set({ settings: updated });
    UserStorage.saveSettings(updated);
    // Обновляем список портфелей для триггера пересчета
    set({ portfolios: [...get().portfolios] });
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

  restoreFullData: (data) => {
    set({
      settings: data.settings || DEFAULT_SETTINGS,
      groups: data.groups || [],
      portfolios: data.portfolios || [],
      selectedPortfolioId: null,
      activeGroupId: null,
    });

    UserStorage.saveSettings(data.settings || DEFAULT_SETTINGS);
    UserStorage.savePortfolios(data.portfolios || []);
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(data.groups || []));
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
  },

  deleteMilestone: (portfolioId, milestoneId) => {
    const updated = get().portfolios.map(p => {
      if (p.id !== portfolioId) return p;
      return { ...p, milestones: p.milestones.filter(m => m.id !== milestoneId) };
    });

    set({ portfolios: updated });
    UserStorage.savePortfolios(updated);
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
      const pGroup = (!p.groupId) ? null : p.groupId;
      return pGroup === activeGroupId;
    });
  },

  getSelectedPortfolio: () => {
    const { portfolios, selectedPortfolioId } = get();
    return portfolios.find(p => p.id === selectedPortfolioId);
  },
}));