import React, { useState, useEffect } from 'react';
import { IMilestone, IAssetAllocation, AssetType } from '../../types/domain';
import { DateTimeStandardizer } from '../../engine/DateTimeStandardizer';
import { TickerResolver } from '../../engine/TickerResolver';
import { POPULAR_MOEX_ASSETS } from '../../constants/defaultStocks';
import { Calendar, Plus, Trash2, Scale, AlertCircle, X, HelpCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  initialMilestone?: IMilestone | null;
  onSave: (milestone: IMilestone) => void;
  onClose: () => void;
}

export const MilestoneEditorModal: React.FC<Props> = ({
  isOpen,
  initialMilestone,
  onSave,
  onClose,
}) => {
  // Локальная дата и час (YYYY-MM-DDTHH:00)
  const [localDateTime, setLocalDateTime] = useState(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now.toISOString().slice(0, 13) + ':00';
  });

  const [assets, setAssets] = useState<IAssetAllocation[]>([]);
  const [newTickerInput, setNewTickerInput] = useState('');
  const [newAssetType, setNewAssetType] = useState<AssetType>('STOCK');

  useEffect(() => {
    if (initialMilestone) {
      const localDisp = DateTimeStandardizer.formatToLocalDisplay(initialMilestone.date);
      setLocalDateTime(localDisp.replace(' ', 'T'));
      setAssets(initialMilestone.assets || []);
    } else {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      setLocalDateTime(now.toISOString().slice(0, 13) + ':00');
      setAssets([]);
    }
  }, [initialMilestone, isOpen]);

  if (!isOpen) return null;

  // Рассчитываем суммарный процент активов
  const totalWeightRaw = assets.reduce((sum, a) => sum + (Number(a.weight) || 0), 0);
  const totalWeight = Math.round(totalWeightRaw * 100) / 100; // Округление для погрешностей float
  const freeCashWeight = Math.max(0, Math.round((100 - totalWeight) * 100) / 100);
  const isOverallocated = totalWeight > 100.001;

  // Добавление актива
  const handleAddAsset = (tickerToAdd: string, typeToAdd: AssetType = 'STOCK') => {
    const cleanTicker = tickerToAdd.trim().toUpperCase();
    if (!cleanTicker) return;

    if (assets.some(a => a.ticker === cleanTicker)) {
      alert(`Актив ${cleanTicker} уже добавлен в список`);
      return;
    }

    setAssets([...assets, { ticker: cleanTicker, weight: 10, type: typeToAdd }]);
    setNewTickerInput('');
  };

  // Удаление актива
  const handleRemoveAsset = (index: number) => {
    setAssets(assets.filter((_, i) => i !== index));
  };

  // Изменение веса актива с точностью ДО СОТЫХ
  const handleWeightChange = (index: number, newWeight: number) => {
    const updated = [...assets];
    // Округляем до сотых
    const rounded = Math.floor(newWeight * 100) / 100;
    updated[index].weight = Math.max(0, Math.min(100, rounded));
    setAssets(updated);
  };

  // КНОПКА: Автоматическая ребалансировка с округлением В МЕНЬШУЮ СТОРУНУ
  const handleAutoRebalance = () => {
    if (assets.length === 0) return;
    // Строгое округление в меньшую сторону до сотых
    const equalWeight = Math.floor((100 / assets.length) * 100) / 100;
    setAssets(assets.map(a => ({ ...a, weight: equalWeight })));
  };

  // Сохранение точки
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOverallocated) return;

    const utcIso = DateTimeStandardizer.toUTCISOString(new Date(localDateTime));

    // Если это новая точка (нет id) или скопированная точка — создаем новый ID
    const isNewPoint = !initialMilestone?.id || initialMilestone.id.startsWith('new_');

    const milestoneToSave: IMilestone = {
      id: isNewPoint ? `mst_${Date.now()}_${Math.random().toString(36).substring(2, 5)}` : initialMilestone.id,
      date: utcIso,
      assets: assets.map(a => ({ 
        ...a, 
        ticker: a.ticker.toUpperCase(), 
        weight: Math.floor((Number(a.weight) || 0) * 100) / 100 
      })),
    };

    onSave(milestoneToSave);
    onClose();
  };

  const targetUtcIso = DateTimeStandardizer.toUTCISOString(new Date(localDateTime));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] flex flex-col">
        
        {/* Заголовок */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 text-sky-500 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {initialMilestone?.id && !initialMilestone.id.startsWith('new_') 
                  ? 'Редактировать контрольную точку' 
                  : 'Новая контрольная точка'}
              </h3>
              <p className="text-xs text-slate-400">Укажите дату/час и состав портфеля</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5 overflow-y-auto pr-1 flex-1">
          
          {/* ПОЛЕ: Дата и Час в локальном времени */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between">
              <span>Дата и час среза (Локальное время):</span>
              <span className="text-[11px] font-mono text-slate-400">Точность до 1 часа</span>
            </label>
            <input
              type="datetime-local"
              step="3600"
              required
              value={localDateTime}
              onChange={e => setLocalDateTime(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* ИНДИКАТОР ВЕСОВ И СВОБОДНОГО КЭША (LQDT) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Распределение портфеля:</span>
              <span className={isOverallocated ? 'text-rose-500 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                Занято: {totalWeight.toFixed(2)}% / 100%
              </span>
            </div>

            {/* Прогресс-бар */}
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

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Свободный кэш (Авто-LQDT): <strong className="text-emerald-500">{freeCashWeight.toFixed(2)}%</strong></span>
              {assets.length > 1 && (
                <button
                  type="button"
                  onClick={handleAutoRebalance}
                  className="flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-medium"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Поровну (Ребаланс)</span>
                </button>
              )}
            </div>

            {isOverallocated && (
              <div className="flex items-center gap-1.5 text-xs text-rose-500 font-medium pt-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Сумма долей превышает 100%! Уменьшите проценты активов.</span>
              </div>
            )}
          </div>

          {/* ДОБАВЛЕНИЕ НОВОГО АКТИВА */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Добавить бумагу:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTickerInput}
                onChange={e => setNewTickerInput(e.target.value.toUpperCase())}
                placeholder="Тикер (напр. SBER)"
                className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono uppercase"
              />
              <select
                value={newAssetType}
                onChange={e => setNewAssetType(e.target.value as AssetType)}
                className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
              >
                <option value="STOCK">Акция</option>
                <option value="FUND">Фонд</option>
              </select>
              <button
                type="button"
                onClick={() => handleAddAsset(newTickerInput, newAssetType)}
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Быстрый выбор */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] text-slate-400">Быстро:</span>
              {POPULAR_MOEX_ASSETS.slice(0, 8).map(pop => (
                <button
                  key={pop.ticker}
                  type="button"
                  onClick={() => handleAddAsset(pop.ticker, pop.type)}
                  className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-sky-500/10 hover:text-sky-500 text-[11px] font-mono rounded-md border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  +{pop.ticker}
                </button>
              ))}
            </div>
          </div>

          {/* СПИСОК ДОБАВЛЕННЫХ АКТИВОВ */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Состав активов ({assets.length}):
            </label>

            {assets.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                Портфель пока состоять только из 100% Кэша (LQDT).<br/>Добавьте акции или фонды выше.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {assets.map((asset, index) => {
                  const resolved = TickerResolver.resolveTicker(asset.ticker, targetUtcIso);
                  const isRenamed = resolved !== asset.ticker;

                  return (
                    <div
                      key={asset.ticker}
                      className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sky-500">{asset.ticker}</span>
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

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={asset.weight}
                            onChange={e => handleWeightChange(index, parseFloat(e.target.value) || 0)}
                            className="w-20 p-1 bg-slate-50 dark:bg-slate-800 border rounded text-right font-mono text-sm font-semibold"
                          />
                          <span className="text-xs text-slate-400">%</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveAsset(index)}
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

          {/* КНОПКИ ДЕЙСТВИЯ */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-sm font-medium rounded-xl transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isOverallocated}
              className="px-5 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
            >
              Сохранить точку
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};