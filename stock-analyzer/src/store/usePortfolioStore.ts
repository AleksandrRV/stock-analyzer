import { create } from 'zustand';
import { IPortfolio, IPortfolioGroup } from '../types/domain';
import { UserStorage } from '../services/storage/userStorage';

const GROUPS_STORAGE_KEY = 'app_user_groups';

interface PortfolioState {
  portfolios: IPortfolio[];
  groups: IPortfolioGroup[];
  activeGroupId: string | null; // null = Базовая группа, 'ARCHIVE' = Архив, string = ID группы
  
  // Загрузка
  loadFromStorage: () => void;
  
  // Действия с портфелями
  createPortfolio: (name: string, groupId?: string | null) => IPortfolio;
  renamePortfolio: (id: string, newName: string) => void;
  deletePortfolio: (id: string) => void;
  movePortfolioToGroup: (portfolioId: string, targetGroupId: string | null) => void;
  archivePortfolio: (portfolioId: string) => void;
  
  // Действия с группами
  createGroup: (name: string) => void;
  deleteGroup: (groupId: string) => void;
  setActiveGroupId: (groupId: string | null) => void;

  // Селекторы (Lazy Loading)
  getVisiblePortfolios: () => IPortfolio[];
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  portfolios: [],
  groups: [],
  activeGroupId: null, // По умолчанию "Базовая группа"

  loadFromStorage: () => {
    const portfolios = UserStorage.getPortfolios();
    const savedGroups = localStorage.getItem(GROUPS_STORAGE_KEY);
    const groups: IPortfolioGroup[] = savedGroups ? JSON.parse(savedGroups) : [];
    
    set({ portfolios, groups });
  },

  setActiveGroupId: (groupId) => {
    set({ activeGroupId: groupId });
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
    set({ portfolios: updated });
    UserStorage.savePortfolios(updated);
  },

  movePortfolioToGroup: (portfolioId, targetGroupId) => {
    const updated = get().portfolios.map(p => 
      p.id === portfolioId ? { ...p, groupId: targetGroupId } : p
    );
    set({ portfolios: updated });
    UserStorage.savePortfolios(updated);
  },

  archivePortfolio: (portfolioId) => {
    get().movePortfolioToGroup(portfolioId, 'ARCHIVE');
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
    // При удалении группы портфели переносятся в Базовую группу (null)
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

  // ГЛАВНЫЙ МЕХАНИЗМ ЛЕНИВОЙ ЗАГРУЗКИ
  // Возвращает ТОЛЬКО портфели активной группы
  getVisiblePortfolios: () => {
    const { portfolios, activeGroupId } = get();
    return portfolios.filter(p => p.groupId === activeGroupId);
  },
}));