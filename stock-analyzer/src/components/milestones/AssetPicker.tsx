import React, { useState } from 'react';
import { AssetType } from '../../types/domain';
import { TickerSearch, ITickerSuggestion } from '../../engine/TickerSearch';
import { RecentTickersStorage } from '../../services/storage/recentTickersStorage';
import { TickerAutocompleteInput } from './TickerAutocompleteInput';
import { QuickTickerPicker } from './QuickTickerPicker';
import { Plus } from 'lucide-react';

interface Props {
  onAdd: (ticker: string, type: AssetType) => boolean;
}

export const AssetPicker: React.FC<Props> = ({ onAdd }) => {
  const [tickerInput, setTickerInput] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('STOCK');
  const [quickTickers, setQuickTickers] = useState<string[]>(() => RecentTickersStorage.getQuickAccess());
  const [error, setError] = useState('');

  const commitAsset = (ticker: string, type: AssetType) => {
    const wasAdded = onAdd(ticker, type);
    if (!wasAdded) return;

    RecentTickersStorage.remember(ticker);
    setQuickTickers(prev => (prev.includes(ticker) ? prev : [...prev, ticker]));
    setTickerInput('');
    setError('');
  };

  const handleSubmitInput = () => {
    const resolved = TickerSearch.resolveInput(tickerInput, assetType);
    if (!resolved) {
      setError('Не удалось распознать бумагу. Уточните тикер или название.');
      return;
    }
    commitAsset(resolved.ticker, resolved.isKnown ? resolved.type : assetType);
  };

  const handlePickSuggestion = (suggestion: ITickerSuggestion) => {
    setTickerInput(suggestion.ticker);
    setAssetType(suggestion.type);
    setError('');
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Добавить бумагу:</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <TickerAutocompleteInput
          value={tickerInput}
          onChange={nextValue => {
            setTickerInput(nextValue);
            setError('');
          }}
          onPickSuggestion={handlePickSuggestion}
          onSubmitInput={handleSubmitInput}
        />
        <div className="flex gap-2 shrink-0">
          <select
            value={assetType}
            onChange={e => setAssetType(e.target.value as AssetType)}
            className="flex-1 sm:flex-none p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
          >
            <option value="STOCK">Акция</option>
            <option value="FUND">Фонд</option>
          </select>
          <button
            type="button"
            onClick={handleSubmitInput}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-700"
          >
            <Plus className="w-4 h-4" />
            <span className="sm:hidden">Добавить</span>
          </button>
        </div>
      </div>

      {error && <p className="text-[11px] text-rose-500 font-medium">{error}</p>}

      <QuickTickerPicker quickTickers={quickTickers} onPick={commitAsset} />
    </div>
  );
};
