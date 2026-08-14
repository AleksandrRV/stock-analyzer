import React from 'react';
import { IAssetAllocation, ITickerRename } from '../../types/domain';
import { TickerResolver } from '../../engine/TickerResolver';
import { IAssetCheckResult } from '../../services/market/MilestoneAssetVerifier';
import { AssetStatusBadge } from './AssetStatusBadge';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, HelpCircle, Trash2 } from 'lucide-react';

export type WeightSortDirection = 'DESC' | 'ASC';

interface Props {
  assets: IAssetAllocation[];
  checks: Record<string, IAssetCheckResult>;
  targetUtcIso: string;
  tickerRenames: ITickerRename[];
  sortDirection: WeightSortDirection;
  onSortByWeight: () => void;
  onWeightChange: (index: number, weight: number) => void;
  onRemove: (index: number) => void;
}

export const MilestoneAssetsList: React.FC<Props> = ({
  assets,
  checks,
  targetUtcIso,
  tickerRenames,
  sortDirection,
  onSortByWeight,
  onWeightChange,
  onRemove,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Состав активов ({assets.length}):
        </label>
        {assets.length > 1 && (
          <button
            type="button"
            onClick={onSortByWeight}
            title="Сортировать по доле в портфеле"
            className="flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline shrink-0"
          >
            {sortDirection === 'DESC'
              ? <ArrowDownWideNarrow className="w-3.5 h-3.5" />
              : <ArrowUpNarrowWide className="w-3.5 h-3.5" />}
            <span>По доле</span>
          </button>
        )}
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs px-3">
          Портфель пока состоять только из 100% Кэша (LQDT).<br />Добавьте акции или фонды выше.
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((asset, index) => {
            const upperTicker = asset.ticker.trim().toUpperCase();
            const resolved = targetUtcIso
              ? TickerResolver.resolveTicker(asset.ticker, targetUtcIso, tickerRenames)
              : upperTicker;
            const isRenamed = resolved !== upperTicker;
            const check = checks[upperTicker];

            return (
              <div
                key={asset.ticker}
                className="flex items-center justify-between gap-2 p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-bold text-sky-500">{upperTicker}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-400">
                      {asset.type === 'STOCK' ? 'Акция' : 'Фонд'}
                    </span>
                    {isRenamed && (
                      <span className="text-[10px] text-purple-500 flex items-center gap-1" title="Машина времени тикеров">
                        <HelpCircle className="w-3 h-3" />
                        <span>({resolved})</span>
                      </span>
                    )}
                  </div>
                  <AssetStatusBadge check={check} />
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={asset.weight}
                    onChange={e => onWeightChange(index, parseFloat(e.target.value) || 0)}
                    className="w-16 sm:w-20 p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-right font-mono text-sm font-semibold"
                  />
                  <span className="text-xs text-slate-400">%</span>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
