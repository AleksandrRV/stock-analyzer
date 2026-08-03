import React from 'react';
import { IPortfolio } from '../types/domain';
import { usePortfolioCalculation } from '../hooks/usePortfolioCalculation';
import { DateTimeStandardizer } from '../engine/DateTimeStandardizer';

import { 
  MoreVertical, 
  Edit3, 
  FolderInput, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Loader2,
  LineChart as ChartIcon
} from 'lucide-react';

interface Props {
  portfolio: IPortfolio;
  onOpen: () => void;
  onOpenAnalytics: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}

export const PortfolioCard: React.FC<Props> = ({
  portfolio,
  onOpen,
  onOpenAnalytics,
  onRename,
  onMove,
  onDelete,
}) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const { result, loading } = usePortfolioCalculation(portfolio);

  const getColorStyles = () => {
    if (!result || portfolio.milestones.length === 0) {
      return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
    switch (result.performanceColor) {
      case 'GREEN':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'YELLOW':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'RED':
      default:
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
    }
  };

  return (
    <div
      onClick={onOpen}
      className={`bg-white dark:bg-slate-800 border rounded-xl p-4 space-y-3 shadow-sm hover:shadow-md transition-all relative cursor-pointer group ${
        result?.performanceColor === 'GREEN'
          ? 'hover:border-emerald-500/50'
          : result?.performanceColor === 'YELLOW'
          ? 'hover:border-amber-500/50'
          : 'hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base leading-snug group-hover:text-sky-500 transition-colors">
              {portfolio.name}
            </h3>
            {portfolio.closedAt && (
              <span className="px-1.5 py-0.5 text-[10px] bg-rose-500/10 text-rose-500 rounded font-semibold">
                Закрыт
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Создан: {DateTimeStandardizer.formatToLocalDisplay(portfolio.createdAt).split(' ')[0]}
            {result && result.totalDays > 0 && (
              <span className="text-slate-500 font-semibold"> ({result.totalDays} дн.)</span>
            )}
          </span>
        </div>

        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-8 z-10 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-1 space-y-0.5 text-sm animate-in fade-in duration-150">
              <button
                onClick={() => { onOpenAnalytics(); setIsMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sky-600 dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-left font-semibold"
              >
                <ChartIcon className="w-4 h-4" />
                <span>Аналитика</span>
              </button>
              <button
                onClick={() => { onRename(); setIsMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-left"
              >
                <Edit3 className="w-4 h-4" />
                <span>Переименовать</span>
              </button>
              <button
                onClick={() => { onMove(); setIsMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-left"
              >
                <FolderInput className="w-4 h-4" />
                <span>Переместить</span>
              </button>
              <button
                onClick={() => { onDelete(); setIsMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-left"
              >
                <Trash2 className="w-4 h-4" />
                <span>Удалить</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-400 font-mono">
          <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
          <span>Загрузка...</span>
        </div>
      ) : portfolio.milestones.length === 0 ? (
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-center text-xs text-slate-400 font-mono">
          Добавьте точку
        </div>
      ) : result ? (
        <div className="space-y-2">
          <div className={`p-2 rounded-lg border flex items-center justify-between font-mono ${getColorStyles()}`}>
            <span className="text-[11px] font-semibold">Альфа (vs MCFTR):</span>
            <span className="text-sm font-bold flex items-center gap-1">
              {result.alphaMonthlyPercent >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {result.alphaMonthlyPercent >= 0 ? '+' : ''}{result.alphaMonthlyPercent.toFixed(2)}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Портфель:</span>
              <span className={`font-bold ${result.monthlyReturnPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {result.monthlyReturnPercent >= 0 ? '+' : ''}{result.monthlyReturnPercent.toFixed(2)}%
              </span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg flex items-center justify-between text-[11px]">
              <span className="text-slate-400">MCFTR:</span>
              <span className={`font-bold ${result.mcftrMonthlyReturnPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {result.mcftrMonthlyReturnPercent >= 0 ? '+' : ''}{result.mcftrMonthlyReturnPercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};