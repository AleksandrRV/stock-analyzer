import React from 'react';
import { IMcftrQuote } from '../../hooks/useMilestoneMarketData';
import { NumberFormatter } from '../../engine/NumberFormatter';
import { Activity, Loader2 } from 'lucide-react';

interface Props {
  mcftr: IMcftrQuote;
}

export const MilestoneMcftrPanel: React.FC<Props> = ({ mcftr }) => {
  return (
    <div className="flex items-center justify-between gap-2 p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl">
      <div className="flex items-center gap-2 min-w-0">
        <Activity className="w-4 h-4 text-purple-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-tight">
            Индекс Мосбиржи полной доходности
          </p>
          <p className="text-[10px] text-slate-400 font-mono leading-tight">MCFTR</p>
        </div>
      </div>

      <div className="text-right shrink-0">
        {mcftr.isLoading ? (
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin ml-auto" />
        ) : mcftr.value === null ? (
          <span className="text-xs text-slate-400">Нет данных</span>
        ) : (
          <>
            <p className="text-sm font-mono font-bold text-purple-500 leading-tight">
              {NumberFormatter.formatIndex(mcftr.value)}
            </p>
            {mcftr.tradeDate && (
              <p className="text-[10px] text-slate-400 leading-tight">
                сессия {NumberFormatter.formatMskDate(mcftr.tradeDate)}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
