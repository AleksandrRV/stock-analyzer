import React, { useState } from 'react';
import { Folder, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}

export const CreateGroupModal: React.FC<Props> = ({ isOpen, onSave, onClose }) => {
  const [name, setName] = useState('');

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
          <div className="p-2.5 bg-purple-500/10 text-purple-500 rounded-xl">
            <Folder className="w-6 h-6" />
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h3 className="text-lg font-bold">Новая папка (Группа)</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Создайте группу для сортировки портфелей (например: "ИТ сектор" или "Эксперименты").
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Название папки"
            className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-sm font-medium rounded-xl transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={name.trim().length < 2}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
            >
              Создать папку
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};