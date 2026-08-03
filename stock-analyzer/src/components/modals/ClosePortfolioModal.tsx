import React, { useState } from 'react';
import { Lock, X, AlertCircle } from 'lucide-react';
import { DateTimeStandardizer } from '../../engine/DateTimeStandardizer';

interface Props {
  isOpen: boolean;
  minDateIso: string | null; 
  onConfirm: (closedAtIso: string) => void;
  onClose: () => void;
}

export const ClosePortfolioModal: React.FC<Props> = ({ isOpen, minDateIso, onConfirm, onClose }) => {
  const [localDateTime, setLocalDateTime] = useState(() => 
    DateTimeStandardizer.getLocalDatetimeLocalString()
  );

  if (!isOpen) return null;

  const selectedUtcIso = DateTimeStandardizer.toUTCISOString(new Date(localDateTime));
  const isInvalid = minDateIso ? new Date(selectedUtcIso).getTime() < new Date(minDateIso).getTime() : false;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalid) return;
    onConfirm(selectedUtcIso);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
            <Lock className="w-6 h-6" />
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h3 className="text-lg font-bold">Фиксация закрытия портфеля</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Выберите дату и час, когда портфель был закрыт. Вся аналитика будет рассчитана строго до этого момента.
          </p>
        </div>

        <form onSubmit={handleConfirm} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Дата и час закрытия:
            </label>
            <input
              type="datetime-local"
              step="3600"
              required
              value={localDateTime}
              onChange={e => setLocalDateTime(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {isInvalid && minDateIso && (
            <div className="flex items-center gap-1.5 text-xs text-rose-500 font-medium pt-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                Дата закрытия не может быть раньше последней точки (
                {DateTimeStandardizer.formatToLocalDisplay(minDateIso)})!
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-sm font-medium rounded-xl transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={isInvalid} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-sm transition-colors">
              Зафиксировать закрытие
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};