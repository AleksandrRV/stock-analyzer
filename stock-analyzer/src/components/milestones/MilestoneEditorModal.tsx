import React, { useState, useEffect, useMemo } from 'react';
import { IMilestone, IAssetAllocation, AssetType } from '../../types/domain';
import { DateTimeStandardizer } from '../../engine/DateTimeStandardizer';
import { usePortfolioStore } from '../../store/usePortfolioStore';
import { useMilestoneMarketData } from '../../hooks/useMilestoneMarketData';
import { AssetPicker } from './AssetPicker';
import { MilestoneAssetsList, WeightSortDirection } from './MilestoneAssetsList';
import { MilestoneMcftrPanel } from './MilestoneMcftrPanel';
import { MilestoneSaveBar } from './MilestoneSaveBar';
import { Calendar, Scale, AlertCircle, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  initialMilestone?: IMilestone | null;
  onSave: (milestone: IMilestone) => void;
  onClose: () => void;
}

const toSafeUtcIso = (localDateTime: string): string => {
  const parsed = new Date(localDateTime);
  if (isNaN(parsed.getTime())) return '';
  return DateTimeStandardizer.toUTCISOString(parsed);
};

export const MilestoneEditorModal: React.FC<Props> = ({
  isOpen,
  initialMilestone,
  onSave,
  onClose,
}) => {
  const { settings } = usePortfolioStore();

  const [localDateTime, setLocalDateTime] = useState(() => 
    DateTimeStandardizer.getLocalDatetimeLocalString()
  );

  const [assets, setAssets] = useState<IAssetAllocation[]>([]);
  const [weightSortDirection, setWeightSortDirection] = useState<WeightSortDirection>('DESC');

  useEffect(() => {
    if (initialMilestone && !initialMilestone.id.startsWith('new_')) {
      // Истинная старая точка - переводим сохраненный UTC в локальный дисплей для инпута
      const localDisp = DateTimeStandardizer.formatToLocalDisplay(initialMilestone.date);
      setLocalDateTime(localDisp.replace(' ', 'T'));
      setAssets(initialMilestone.assets || []);
    } else if (initialMilestone && initialMilestone.id.startsWith('new_')) {
      // Скопированная точка или новая - используем текущее локальное время
      setLocalDateTime(DateTimeStandardizer.getLocalDatetimeLocalString(initialMilestone.date));
      setAssets(initialMilestone.assets || []);
    } else {
      setLocalDateTime(DateTimeStandardizer.getLocalDatetimeLocalString());
      setAssets([]);
    }
    setWeightSortDirection('DESC');
  }, [initialMilestone, isOpen]);

  const targetUtcIso = useMemo(() => toSafeUtcIso(localDateTime), [localDateTime]);

  const { checks, mcftr, isVerifying, invalidTickers, unverifiedTickers } = useMilestoneMarketData(
    assets,
    targetUtcIso,
    settings,
    isOpen
  );

  if (!isOpen) return null;

  const totalWeightRaw = assets.reduce((sum, a) => sum + (Number(a.weight) || 0), 0);
  const totalWeight = Math.round(totalWeightRaw * 100) / 100; 
  const freeCashWeight = Math.max(0, Math.round((100 - totalWeight) * 100) / 100);
  const isOverallocated = totalWeight > 100.001;

  const handleAddAsset = (tickerToAdd: string, typeToAdd: AssetType = 'STOCK'): boolean => {
    const cleanTicker = tickerToAdd.trim().toUpperCase();
    if (!cleanTicker) return false;

    if (assets.some(a => a.ticker.trim().toUpperCase() === cleanTicker)) {
      alert(`Актив ${cleanTicker} уже добавлен в список`);
      return false;
    }

    setAssets(prev => [...prev, { ticker: cleanTicker, weight: 10, type: typeToAdd }]);
    return true;
  };

  const handleRemoveAsset = (index: number) => {
    setAssets(assets.filter((_, i) => i !== index));
  };

  const handleWeightChange = (index: number, newWeight: number) => {
    const updated = [...assets];
    const rounded = Math.floor(newWeight * 100) / 100;
    updated[index].weight = Math.max(0, Math.min(100, rounded));
    setAssets(updated);
  };

  const handleAutoRebalance = () => {
    if (assets.length === 0) return;
    const equalWeight = Math.floor((100 / assets.length) * 100) / 100;
    setAssets(assets.map(a => ({ ...a, weight: equalWeight })));
  };

  const handleSortByWeight = () => {
    const direction: WeightSortDirection = weightSortDirection === 'DESC' ? 'ASC' : 'DESC';
    const sorted = [...assets].sort((a, b) => {
      const weightA = Number(a.weight) || 0;
      const weightB = Number(b.weight) || 0;
      if (weightA !== weightB) return direction === 'DESC' ? weightB - weightA : weightA - weightB;
      return a.ticker.localeCompare(b.ticker);
    });

    setAssets(sorted);
    setWeightSortDirection(direction);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOverallocated || isVerifying || invalidTickers.length > 0 || !targetUtcIso) return;

    const isNewPoint = !initialMilestone?.id || initialMilestone.id.startsWith('new_');

    const milestoneToSave: IMilestone = {
      id: isNewPoint ? `mst_${Date.now()}_${Math.random().toString(36).substring(2, 5)}` : initialMilestone!.id,
      date: targetUtcIso,
      assets: assets.map(a => ({ 
        ...a, 
        ticker: a.ticker.toUpperCase(), 
        weight: Math.floor((Number(a.weight) || 0) * 100) / 100 
      })),
    };

    onSave(milestoneToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl w-full max-w-2xl p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] flex flex-col overflow-hidden">
        
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-sky-500/10 text-sky-500 rounded-xl shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold truncate">
                {initialMilestone?.id && !initialMilestone.id.startsWith('new_') 
                  ? 'Редактировать точку' 
                  : 'Новая контрольная точка'}
              </h3>
              <p className="text-xs text-slate-400 truncate">Укажите дату/час и состав портфеля</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 overflow-y-auto overflow-x-hidden flex-1 pr-0.5">
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between gap-2 flex-wrap">
              <span>Дата и час среза (Локальное время):</span>
              <span className="text-[11px] font-mono text-slate-400">Точность до 1 часа</span>
            </label>
            <input
              type="datetime-local"
              step="3600"
              required
              value={localDateTime}
              onChange={e => setLocalDateTime(e.target.value)}
              className="w-full min-w-0 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold flex-wrap">
              <span>Распределение портфеля:</span>
              <span className={isOverallocated ? 'text-rose-500 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                Занято: {totalWeight.toFixed(2)}% / 100%
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all ${isOverallocated ? 'bg-rose-500' : 'bg-sky-500'}`}
                style={{ width: `${Math.min(100, totalWeight)}%` }}
              />
              {!isOverallocated && (
                <div
                  className="h-full bg-emerald-500 transition-all opacity-80"
                  style={{ width: `${freeCashWeight}%` }}
                  title="Автоматический фонд ликвидности LQDT"
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 flex-wrap">
              <span>Свободный кэш (Авто-LQDT): <strong className="text-emerald-500">{freeCashWeight.toFixed(2)}%</strong></span>
              {assets.length > 1 && (
                <button type="button" onClick={handleAutoRebalance} className="flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-medium">
                  <Scale className="w-3.5 h-3.5" /><span>Поровну (Ребаланс)</span>
                </button>
              )}
            </div>

            {isOverallocated && (
              <div className="flex items-start gap-1.5 text-xs text-rose-500 font-medium pt-1">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                <span>Сумма долей превышает 100%! Уменьшите проценты активов.</span>
              </div>
            )}
          </div>

          <MilestoneMcftrPanel mcftr={mcftr} />

          <AssetPicker onAdd={handleAddAsset} />

          <MilestoneAssetsList
            assets={assets}
            checks={checks}
            targetUtcIso={targetUtcIso}
            tickerRenames={settings.tickerRenames || []}
            sortDirection={weightSortDirection}
            onSortByWeight={handleSortByWeight}
            onWeightChange={handleWeightChange}
            onRemove={handleRemoveAsset}
          />

          <MilestoneSaveBar
            assetCount={assets.length}
            isVerifying={isVerifying}
            isOverallocated={isOverallocated}
            invalidTickers={invalidTickers}
            unverifiedTickers={unverifiedTickers}
            onClose={onClose}
          />
        </form>
      </div>
    </div>
  );
};
