import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  portfolioName: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDeleteModal: React.FC<Props> = ({ isOpen, portfolioName, onConfirm, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h3 className="text-lg font-bold">Удалить портфель?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Вы уверены, что хотите безвозвратно удалить портфель <span className="font-semibold text-slate-900 dark:text-slate-100">"{portfolioName}"</span>? Это действие нельзя отменить.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium rounded-xl transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            Удалить портфель
          </button>
        </div>
      </div>
    </div>
  );
};