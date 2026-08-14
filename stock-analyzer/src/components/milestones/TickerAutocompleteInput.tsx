import React, { useMemo, useRef, useState } from 'react';
import { TickerSearch, ITickerSuggestion } from '../../engine/TickerSearch';
import { Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onPickSuggestion: (suggestion: ITickerSuggestion) => void;
  onSubmitInput: () => void;
}

export const TickerAutocompleteInput: React.FC<Props> = ({
  value,
  onChange,
  onPickSuggestion,
  onSubmitInput,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    if (value.trim().length < 1) return [];
    return TickerSearch.search(value, 8);
  }, [value]);

  const isDropdownVisible = isOpen && suggestions.length > 0;

  const handleChange = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handlePick = (suggestion: ITickerSuggestion) => {
    onPickSuggestion(suggestion);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isDropdownVisible) {
        setIsOpen(true);
        return;
      }
      setActiveIndex(prev => (prev + 1) % suggestions.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isDropdownVisible) return;
      setActiveIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      return;
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (isDropdownVisible && activeIndex >= 0) {
        handlePick(suggestions[activeIndex]);
        return;
      }
      setIsOpen(false);
      onSubmitInput();
    }
  };

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 120)}
        onKeyDown={handleKeyDown}
        placeholder="Тикер или название (SBER, Сбер, озон...)"
        autoComplete="off"
        className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-sky-500"
      />

      {isDropdownVisible && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.ticker}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => handlePick(suggestion)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                index === activeIndex ? 'bg-sky-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{suggestion.name}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-400">
                  {suggestion.type === 'STOCK' ? 'Акция' : 'Фонд'}
                </span>
                <span className="font-mono text-xs font-bold text-sky-500">{suggestion.ticker}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
