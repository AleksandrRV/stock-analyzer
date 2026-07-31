import React, { useState } from 'react';
import { usePortfolioStore } from '../store/usePortfolioStore';
import { IMilestone } from '../types/domain';
import { DateTimeStandardizer } from '../engine/DateTimeStandardizer';
import { TickerResolver } from '../engine/TickerResolver';
import { MilestoneEditorModal } from './milestones/MilestoneEditorModal';
import { ClosePortfolioModal } from './modals/ClosePortfolioModal';
import { usePortfolioCalculation } from '../hooks/usePortfolioCalculation';

import { 
  ArrowLeft, 
  CalendarPlus, 
  Calendar, 
  Trash2, 
  Edit3, 
  Copy, 
  Lock, 
  Unlock, 
  Clock,
  TrendingUp,
  TrendingDown,
  Loader2
} from 'lucide-react';

export const PortfolioDetailView: React.FC = () => {
  const { 
    getSelectedPortfolio, 
    setSelectedPortfolioId, 
    addMilestone, 
    updateMilestone, 
    deleteMilestone,
    closePortfolio 
  } = usePortfolioStore();

  const portfolio = getSelectedPortfolio();
  const { result, loading } = usePortfolioCalculation(portfolio!);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<IMilestone | null>(null);

  if (!portfolio) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Портфель не найден</p>
        <button
          onClick={() => setSelectedPortfolioId(null)}
          className="mt-4 px-4 py-2 bg-sky-500 text-white rounded-xl text-sm"
        >
          Вернуться на Дашборд
        </button>
      </div>
    );
  }

  const sortedMilestones = [...portfolio.milestones].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Самая свежая точка для ограничения даты закрытия
  const latestMilestoneDateIso = sortedMilestones.length > 0 ? sortedMilestones[0].date : null;

  const handleOpenNewMilestone = () => {
    let prefilledAssets = [];
    if (sortedMilestones.length > 0) {
      prefilledAssets = sortedMilestones[0].assets.map(a => ({ ...a }));
    }
    const nowIso = DateTimeStandardizer.toUTCISOString(new Date());

    setEditingMilestone({
      id: `new_${Date.now()}`,
      date: nowIso,
      assets: prefilledAssets,
    });
    setIsEditorOpen(true);
  };

  const handleDuplicateMilestone = (sourceMilestone: IMilestone) => {
    setEditingMilestone({
      id: `new_${Date.now()}`,
      date: sourceMilestone.date,
      assets: sourceMilestone.assets.map(a => ({ ...a })),
    });
    setIsEditorOpen(true);
  };

  const handleSaveMilestone = (milestone: IMilestone) => {
    const exists = portfolio.milestones.some(m => m.id === milestone.id);
    if (exists) {
      updateMilestone(portfolio.id, milestone);
    } else {
      addMilestone(portfolio.id, milestone);
    }
  };

  const handleToggleClosePortfolio = () => {
    if (portfolio.closedAt) {
      closePortfolio(portfolio.id, null); // Открыть портфель
    } else {
      setIsCloseModalOpen(true); // Открыть модалку выбора даты закрытия
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ШАПКА ПОРТФЕЛЯ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedPortfolioId(null)}
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
            title="Назад к Дашборду"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{portfolio.name}</h2>
              {portfolio.closedAt && (
                <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-semibold rounded-md">
                  Закрыт {DateTimeStandardizer.formatToLocalDisplay(portfolio.closedAt).split(' ')[0]}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Создан: {DateTimeStandardizer.formatToLocalDisplay(portfolio.createdAt)}
              {result && result.totalDays > 0 && (
                <span className="text-slate-500 font-semibold"> ({result.totalDays} дн.)</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleClosePortfolio}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors ${
              portfolio.closedAt
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {portfolio.closedAt ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span>{portfolio.closedAt ? 'Открыть портфель' : 'Зафиксировать закрытие'}</span>
          </button>

          <button
            onClick={handleOpenNewMilestone}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-medium text-sm rounded-xl shadow-sm transition-all"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Добавить точку</span>
          </button>
        </div>
      </div>

      {/* ФИНАНСОВЫЙ БАННЕР */}
      {loading ? (
        <div className="p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex items-center justify-center gap-3 text-slate-400 font-mono text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
          <span>Загрузка цен, дивидендов и индексов MOEX...</span>
        </div>
      ) : result && portfolio.milestones.length > 0 ? (
        <div className="p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Результат стратегии (За {result.totalDays} дней)
            </span>

            <div className={`px-3 py-1 rounded-full border text-xs font-mono font-bold flex items-center gap-1.5 w-fit ${
              result.performanceColor === 'GREEN'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : result.performanceColor === 'YELLOW'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
            }`}>
              {result.alphaMonthlyPercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>Альфа: {result.alphaMonthlyPercent >= 0 ? '+' : ''}{result.alphaMonthlyPercent.toFixed(2)}% / мес</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-sm">
            <div>
              <span className="text-[11px] text-slate-400 block">Общий профит:</span>
              <span className={`text-lg font-bold ${result.totalProfitPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {result.totalProfitPercent >= 0 ? '+' : ''}{result.totalProfitPercent.toFixed(2)}%
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">В месяц (CAGR):</span>
              <span className={`text-lg font-bold ${result.monthlyReturnPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {result.monthlyReturnPercent >= 0 ? '+' : ''}{result.monthlyReturnPercent.toFixed(2)}%
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">Годовая (CAGR):</span>
              <span className={`text-lg font-bold ${result.annualizedReturnPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {result.annualizedReturnPercent >= 0 ? '+' : ''}{result.annualizedReturnPercent.toFixed(2)}%
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">MCFTR (в мес):</span>
              <span className={`text-lg font-bold ${result.mcftrMonthlyReturnPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {result.mcftrMonthlyReturnPercent >= 0 ? '+' : ''}{result.mcftrMonthlyReturnPercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* СПИСОК КОНТРОЛЬНЫХ ТОЧЕК */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Контрольные точки ({portfolio.milestones.length})</h3>
          <span className="text-xs text-slate-400">Свежие — сверху</span>
        </div>

        {sortedMilestones.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 bg-sky-500/10 text-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-base mb-1">Точки среза пока не заданы</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
              Добавьте хотя бы одну контрольную точку с датой, часом и составом акций для старта расчета стратегии.
            </p>
            <button
              onClick={handleOpenNewMilestone}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-white font-medium text-sm rounded-xl shadow-sm hover:bg-sky-600 transition-colors"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>Добавить первую точку</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedMilestones.map((milestone, idx) => {
              const chronologicalIndex = portfolio.milestones.length - idx;
              const calcMs = result?.calculatedMilestones.find(m => m.milestoneId === milestone.id);

              return (
                <div
                  key={milestone.id}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/70 rounded-2xl p-5 space-y-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-sky-500/10 text-sky-500 rounded-xl font-mono text-xs font-bold">
                        #{chronologicalIndex}
                      </div>
                      <div>
                        <div className="font-bold font-mono text-base flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>{DateTimeStandardizer.formatToLocalDisplay(milestone.date)}</span>
                          
                          {/* ДЛИТЕЛЬНОСТЬ ТОЧКИ (В ДНЯХ ИЛИ ЧАСАХ) */}
                          {calcMs && (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-md">
                              {calcMs.durationDays >= 1 ? `${calcMs.durationDays} дн.` : `${calcMs.durationHours} ч.`}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">UTC: {milestone.date}</span>
                      </div>
                    </div>

                    {/* ДОХОДНОСТЬ И ДЕЛЬТА MCFTR НА УРОВНЕ ТОЧКИ */}
                    <div className="flex items-center gap-3">
                      {calcMs && (
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <div className="px-2.5 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                            <span className="text-slate-400">Профит: </span>
                            <span className={`font-bold ${calcMs.totalProfitPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {calcMs.totalProfitPercent >= 0 ? '+' : ''}{calcMs.totalProfitPercent.toFixed(2)}%
                            </span>
                          </div>

                          <div className="px-2.5 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                            <span className="text-slate-400">MCFTR: </span>
                            <span className={`font-bold ${calcMs.mcftrProfitPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {calcMs.mcftrProfitPercent >= 0 ? '+' : ''}{calcMs.mcftrProfitPercent.toFixed(2)}%
                            </span>
                          </div>

                          <div className={`px-2.5 py-1 rounded-lg font-bold border ${
                            calcMs.mcftrAlphaPercent > 0.9
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : calcMs.mcftrAlphaPercent >= 0.01
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          }`}>
                            Разница: {calcMs.mcftrAlphaPercent >= 0 ? '+' : ''}{calcMs.mcftrAlphaPercent.toFixed(2)}%
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDuplicateMilestone(milestone)}
                          className="p-1.5 text-slate-400 hover:text-sky-500 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors"
                          title="Скопировать точку"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setEditingMilestone(milestone);
                            setIsEditorOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Редактировать точку"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => deleteMilestone(portfolio.id, milestone.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          title="Удалить точку"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* СОСТАВ БУМАГ С ИСПРАВЛЕННОЙ СТРЕЛКОЙ */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {milestone.assets.map(asset => {
                      const resolved = TickerResolver.resolveTicker(asset.ticker, milestone.date);
                      const calcAsset = calcMs?.assets.find(a => a.ticker === asset.ticker);

                      return (
                        <div
                          key={asset.ticker}
                          className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1.5 font-mono"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-bold text-sky-500">{asset.ticker}</span>
                              {resolved !== asset.ticker && (
                                <span className="text-[10px] text-purple-400 block">({resolved})</span>
                              )}
                            </div>
                            <span className="font-semibold px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded">
                              {asset.weight}%
                            </span>
                          </div>

                          {calcAsset && (
                            <div className="space-y-0.5 text-[11px] text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-1.5">
                              {/* ИСПРАВЛЕННАЯ СТРЕЛКА → */}
                              <div className="flex justify-between">
                                <span>Цены:</span>
                                <span>{calcAsset.startPrice} → {calcAsset.finishPrice} ₽</span>
                              </div>
                              {calcAsset.rawDividends > 0 && (
                                <div className="flex justify-between text-emerald-500 font-semibold">
                                  <span>Дивы (чистыми):</span>
                                  <span>+{calcAsset.netDividends.toFixed(2)} ₽</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold pt-0.5 border-t border-dashed">
                                <span>Профит:</span>
                                <span className={calcAsset.profitPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                  {calcAsset.profitPercent >= 0 ? '+' : ''}{calcAsset.profitPercent.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Свободный кэш (LQDT) */}
                    {calcMs && calcMs.freeCashWeight > 0 && (
                      <div className="p-3 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-xs space-y-1.5 font-mono">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">LQDT (Кэш)</span>
                          <span className="font-semibold px-1.5 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded">
                            {calcMs.freeCashWeight.toFixed(2)}%
                          </span>
                        </div>
                        <div className="space-y-0.5 text-[11px] text-slate-500 border-t border-emerald-500/20 pt-1.5">
                          {/* ИСПРАВЛЕННАЯ СТРЕЛКА → */}
                          <div className="flex justify-between">
                            <span>Цены:</span>
                            <span>{calcMs.lqdtStartPrice} → {calcMs.lqdtFinishPrice} ₽</span>
                          </div>
                          <div className="flex justify-between font-bold pt-0.5 border-t border-dashed border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            <span>Профит:</span>
                            <span>+{calcMs.lqdtProfitPercent.toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Модалки */}
      <MilestoneEditorModal
        isOpen={isEditorOpen}
        initialMilestone={editingMilestone}
        onSave={handleSaveMilestone}
        onClose={() => setIsEditorOpen(false)}
      />

      <ClosePortfolioModal
        isOpen={isCloseModalOpen}
        minDateIso={latestMilestoneDateIso}
        onConfirm={(closedAtIso) => closePortfolio(portfolio.id, closedAtIso)}
        onClose={() => setIsCloseModalOpen(false)}
      />
    </div>
  );
};