import React, { useEffect, useState } from 'react';
import { usePortfolioStore } from '../store/usePortfolioStore';
import { IPortfolio, IPortfolioGroup } from '../types/domain';
import { DateTimeStandardizer } from '../engine/DateTimeStandardizer';
import { CreatePortfolioModal } from './modals/CreatePortfolioModal';
import { ConfirmDeleteModal } from './modals/ConfirmDeleteModal';
import { CreateGroupModal } from './modals/CreateGroupModal';
import { ChangeGroupModal } from './modals/ChangeGroupModal';
import { DebugPanel } from './DebugPanel';

import { 
  Plus, 
  FolderPlus, 
  Folder, 
  Archive, 
  MoreVertical, 
  Edit3, 
  FolderInput, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Briefcase,
  ChevronRight
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    groups,
    activeGroupId,
    loadFromStorage,
    setActiveGroupId,
    setSelectedPortfolioId, // НОВОЕ: Открытие портфеля
    createPortfolio,
    renamePortfolio,
    deletePortfolio,
    movePortfolioToGroup,
    createGroup,
    deleteGroup,
    getVisiblePortfolios,
  } = usePortfolioStore();

  const [isCreatePortModalOpen, setIsCreatePortModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<IPortfolio | null>(null);
  const [deletingPortfolio, setDeletingPortfolio] = useState<IPortfolio | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<IPortfolioGroup | null>(null);
  const [movingPortfolio, setMovingPortfolio] = useState<IPortfolio | null>(null);

  const [showDebug, setShowDebug] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const visiblePortfolios = getVisiblePortfolios();

  return (
    <div className="space-y-6">
      
      {/* ВЕРХНЯЯ ПАНЕЛЬ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ваши портфели</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Управляйте инвестиционными стратегиями и группами
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateGroupModalOpen(true)}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm rounded-xl transition-all"
          >
            <FolderPlus className="w-4 h-4 text-purple-500" />
            <span className="hidden sm:inline">Новая папка</span>
          </button>

          <button
            onClick={() => setIsCreatePortModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-medium text-sm rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Создать портфель</span>
          </button>
        </div>
      </div>

      {/* ТАБЫ ГРУПП */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setActiveGroupId(null)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
            activeGroupId === null
              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Базовая группа</span>
        </button>

        {groups.map(group => (
          <div key={group.id} className="flex items-center group">
            <button
              onClick={() => setActiveGroupId(group.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeGroupId === group.id
                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Folder className="w-4 h-4 text-purple-500" />
              <span>{group.name}</span>
            </button>
            {activeGroupId === group.id && (
              <button
                onClick={() => setDeletingGroup(group)}
                title="Удалить папку"
                className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        <button
          onClick={() => setActiveGroupId('ARCHIVE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
            activeGroupId === 'ARCHIVE'
              ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300 font-semibold'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Архив</span>
        </button>
      </div>

      {/* СЕТКА КАРТОЧЕК ПОРТФЕЛЕЙ */}
      {visiblePortfolios.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiblePortfolios.map(portfolio => (
            <div
              key={portfolio.id}
              onClick={() => setSelectedPortfolioId(portfolio.id)} // Клик открывает детальный вид
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/70 rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition-all relative group cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-lg leading-snug group-hover:text-sky-500 transition-colors">
                    {portfolio.name}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    Создан: {DateTimeStandardizer.formatToLocalDisplay(portfolio.createdAt).split(' ')[0]}
                  </span>
                </div>

                <div className="relative" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setActiveMenuId(activeMenuId === portfolio.id ? null : portfolio.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {activeMenuId === portfolio.id && (
                    <div className="absolute right-0 top-8 z-10 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-1 space-y-0.5 text-sm animate-in fade-in duration-150">
                      <button
                        onClick={() => {
                          setEditingPortfolio(portfolio);
                          setActiveMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-left"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Переименовать</span>
                      </button>

                      <button
                        onClick={() => {
                          setMovingPortfolio(portfolio);
                          setActiveMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-left"
                      >
                        <FolderInput className="w-4 h-4" />
                        <span>Переместить</span>
                      </button>

                      <button
                        onClick={() => {
                          setDeletingPortfolio(portfolio);
                          setActiveMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-left"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Удалить</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Точек среза: {portfolio.milestones.length}</span>
                <span className="text-sky-500 font-semibold flex items-center gap-1">
                  <span>Открыть</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            В этой группе пока нет портфелей.
          </p>
          <button
            onClick={() => setIsCreatePortModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium text-sm rounded-xl hover:bg-sky-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить портфель</span>
          </button>
        </div>
      )}

      {/* СКЛАД */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mb-4"
        >
          {showDebug ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span>{showDebug ? 'Скрыть песочницу (Этапы 2-3)' : 'Показать песочницу матем. ядра и MOEX API'}</span>
        </button>

        {showDebug && <DebugPanel />}
      </div>

      {/* МОДАЛЬНЫЕ ОКНА */}
      <CreatePortfolioModal
        isOpen={isCreatePortModalOpen}
        onSave={(name) => createPortfolio(name)}
        onClose={() => setIsCreatePortModalOpen(false)}
      />

      <CreatePortfolioModal
        isOpen={!!editingPortfolio}
        initialName={editingPortfolio?.name || ''}
        title="Переименовать портфель"
        onSave={(newName) => editingPortfolio && renamePortfolio(editingPortfolio.id, newName)}
        onClose={() => setEditingPortfolio(null)}
      />

      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onSave={(name) => createGroup(name)}
        onClose={() => setIsCreateGroupModalOpen(false)}
      />

      <ChangeGroupModal
        isOpen={!!movingPortfolio}
        currentGroupId={movingPortfolio?.groupId ?? null}
        groups={groups}
        onSelectGroup={(targetGroupId) => movingPortfolio && movePortfolioToGroup(movingPortfolio.id, targetGroupId)}
        onClose={() => setMovingPortfolio(null)}
      />

      <ConfirmDeleteModal
        isOpen={!!deletingPortfolio}
        portfolioName={deletingPortfolio?.name || ''}
        onConfirm={() => deletingPortfolio && deletePortfolio(deletingPortfolio.id)}
        onClose={() => setDeletingPortfolio(null)}
      />

      <ConfirmDeleteModal
        isOpen={!!deletingGroup}
        portfolioName={`папку "${deletingGroup?.name}" (портфели вернутся в Базовую группу)`}
        onConfirm={() => deletingGroup && deleteGroup(deletingGroup.id)}
        onClose={() => setDeletingGroup(null)}
      />
    </div>
  );
};