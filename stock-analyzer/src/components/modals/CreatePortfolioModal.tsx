import React, { useState, useEffect } from 'react';
import { FolderPlus, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  initialName?: string;
  title?: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

export const CreatePortfolioModal: React.FC<Props> = ({
  isOpen,
  initialName = '',
  title = 'Создать новый портфель',
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    setName(initialName);
  }, [initialName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length >= 2) {
      onSave(name.trim());
      setName('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="p-2.5 bg-sky-500/10 text-sky-500 rounded-xl">
            <FolderPlus className="w-6 h-6" />
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Укажите понятное название для вашей инвестиционной стратегии.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Например: Агрессивный рост 2024"
            className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium rounded-xl transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={name.trim().length < 2}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};