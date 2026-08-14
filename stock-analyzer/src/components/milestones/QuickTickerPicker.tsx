import React, { useMemo, useState } from 'react';
import { AssetType } from '../../types/domain';
import { MOEX_ASSET_CATALOG, findCatalogAsset } from '../../constants/assets';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  quickTickers: string[];
  onPick: (ticker: string, type: AssetType) => void;
}

export const QuickTickerPicker: React.FC<Props> = ({ quickTickers, onPick }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const sortedQuick = useMemo(
    () => [...quickTickers].sort((a, b) => a.localeCompare(b)),
    [quickTickers]
  );

  const restOfCatalog = useMemo(
    () => MOEX_ASSET_CATALOG.filter(asset => !sortedQuick.includes(asset.ticker)),
    [sortedQuick]
  );

  const handleQuickPick = (ticker: string) => {
    const known = findCatalogAsset(ticker);
    onPick(ticker, known ? known.type : 'STOCK');
  };

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-slate-400">Быстро:</span>
        {sortedQuick.map(ticker => (
          <button
            key={ticker}
            type="button"
            title={findCatalogAsset(ticker)?.name || ticker}
            onClick={() => handleQuickPick(ticker)}
            className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-sky-500/10 hover:text-sky-500 text-[11px] font-mono rounded-md border border-slate-200 dark:border-slate-700 transition-colors"
          >
            {ticker}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline"
        >
          <span>{isExpanded ? 'Свернуть список' : `Все бумаги (${restOfCatalog.length})`}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-xl">
          <div className="flex items-center gap-1.5 flex-wrap">
            {restOfCatalog.map(asset => (
              <button
                key={asset.ticker}
                type="button"
                title={asset.name}
                onClick={() => onPick(asset.ticker, asset.type)}
                className="px-2 py-0.5 bg-white dark:bg-slate-800 hover:bg-sky-500/10 hover:text-sky-500 text-[11px] font-mono rounded-md border border-slate-200 dark:border-slate-700 transition-colors"
              >
                {asset.ticker}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
