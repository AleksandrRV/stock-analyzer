import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save, WifiOff } from 'lucide-react';

interface Props {
  assetCount: number;
  isVerifying: boolean;
  isOverallocated: boolean;
  invalidTickers: string[];
  unverifiedTickers: string[];
  onClose: () => void;
}

export const MilestoneSaveBar: React.FC<Props> = ({
  assetCount,
  isVerifying,
  isOverallocated,
  invalidTickers,
  unverifiedTickers,
  onClose,
}) => {
  const hasInvalid = invalidTickers.length > 0;
  const isBlocked = isVerifying || hasInvalid || isOverallocated;

  const renderHint = () => {
    if (assetCount === 0) {
      return (
        <span className="text-[11px] text-slate-400">
          Точка будет сохранена как 100% свободного кэша (LQDT)
        </span>
      );
    }

    if (isVerifying) {
      return (
        <span className="flex items-center gap-1.5 text-[11px] text-sky-600 dark:text-sky-400 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>Проверяем активы на Мосбирже...</span>
        </span>
      );
    }

    if (hasInvalid) {
      return (
        <span className="flex items-start gap-1.5 text-[11px] text-rose-500 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>Проверьте активы: {invalidTickers.join(', ')}</span>
        </span>
      );
    }

    if (unverifiedTickers.length > 0) {
      return (
        <span className="flex items-start gap-1.5 text-[11px] text-amber-500 font-medium">
          <WifiOff className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>Проверка недоступна офлайн: {unverifiedTickers.join(', ')}</span>
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Все активы проверены</span>
      </span>
    );
  };

  return (
    <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-3">
      <div className="min-w-0">{renderHint()}</div>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-sm font-medium rounded-xl transition-colors"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={isBlocked}
          className="flex items-center justify-center gap-2 px-5 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
        >
          {isVerifying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Проверка активов</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Сохранить точку</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
