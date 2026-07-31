import React from 'react';
import { IPortfolioGroup } from '../../types/domain';
import { FolderInput, Archive, Check, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  currentGroupId: string | null;
  groups: IPortfolioGroup[];
  onSelectGroup: (targetGroupId: string | null) => void;
  onClose: () => void;
}

export const ChangeGroupModal: React.FC<Props> = ({
  isOpen,
  currentGroupId,
  groups,
  onSelectGroup,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
            <FolderInput className="w-6 h-6" />
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h3 className="text-lg font-bold">Переместить портфель</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Выберите папку назначения для этого портфеля:
          </p>
        </div>

        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {/* Базовая группа */}
          <button
            onClick={() => {
              onSelectGroup(null);
              onClose();
            }}
            className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all ${
              currentGroupId === null
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
            }`}
          >
            <span>Базовая группа (Без папки)</span>
            {currentGroupId === null && <Check className="w-4 h-4 text-sky-500" />}
          </button>

          {/* Пользовательские группы */}
          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => {
                onSelectGroup(group.id);
                onClose();
              }}
              className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all ${
                currentGroupId === group.id
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>{group.name}</span>
              {currentGroupId === group.id && <Check className="w-4 h-4 text-purple-500" />}
            </button>
          ))}

          {/* Архив */}
          <button
            onClick={() => {
              onSelectGroup('ARCHIVE');
              onClose();
            }}
            className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all ${
              currentGroupId === 'ARCHIVE'
                ? 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-500'
            }`}
          >
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4" />
              <span>Архив</span>
            </div>
            {currentGroupId === 'ARCHIVE' && <Check className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </div>
    </div>
  );
};