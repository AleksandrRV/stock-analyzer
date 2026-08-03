import React, { useState } from 'react';
import { usePortfolioStore } from '../store/usePortfolioStore';
import { IMilestone, IAssetAllocation } from '../types/domain';
import { DateTimeStandardizer } from '../engine/DateTimeStandardizer';
import { TickerResolver } from '../engine/TickerResolver';
import { MilestoneEditorModal } from './milestones/MilestoneEditorModal';
import { ClosePortfolioModal } from './modals/ClosePortfolioModal';
import { usePortfolioCalculation } from '../hooks/usePortfolioCalculation';
import { PortfolioChart } from './analytics/PortfolioChart';
import { MonthlyReturnsMatrix } from './analytics/MonthlyReturnsMatrix';

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
  Loader2,
  LineChart as ChartIcon,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChevronRight
} from 'lucide-react';

const MilestoneItem: React.FC<{
  milestone: IMilestone;
  idx: number;
  totalLength: number;
  calcMs: any;
  settings: any;
  handleDuplicate: (m: IMilestone) => void;
  handleEdit: (m: IMilestone) => void;
  handleDelete: (id: string) => void;
}> = ({ milestone, idx, totalLength, calcMs, settings, handleDuplicate, handleEdit, handleDelete }) => {
  const [isAssetsOpen, setIsAssetsOpen] = useState(false);
  const chronologicalIndex = totalLength - idx;

  const allocatedSum = milestone.assets.reduce((sum, a) => sum + Number(a.weight), 0);
  const freeCash = Math.max(0, Math.round((100 - allocatedSum) * 100) / 100);

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/70 rounded-2xl p-4 shadow-sm transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-sky-500/10 text-sky-500 rounded-lg font-mono text-[11px] font-bold">
            #{chronologicalIndex}
          </div>
          <div>
            <div className="font-bold font-mono text-sm flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{DateTimeStandardizer.formatToLocalDisplay(milestone.date)}</span>
              {calcMs && (
                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 text-[10px] font-semibold rounded">
                  {calcMs.durationDays >= 1 ? `${calcMs.durationDays} дн.` : `${calcMs.durationHours} ч.`}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">UTC: {milestone.date}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {calcMs && (
            <div className="flex items-center gap-1 font-mono text-[10px]">
              <div className="px-2 py-0.5 bg-slate-100 dark:bg-slate-900 rounded border border-transparent">
                <span className="text-slate-400">П: </span>
                <span className={`font-bold ${calcMs.totalProfitPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {calcMs.totalProfitPercent >= 0 ? '+' : ''}{calcMs.totalProfitPercent.toFixed(2)}%
                </span>
              </div>
              <div className="px-2 py-0.5 bg-slate-100 dark:bg-slate-900 rounded border border-transparent">
                <span className="text-slate-400">И: </span>
                <span className={`font-bold ${calcMs.mcftrProfitPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {calcMs.mcftrProfitPercent >= 0 ? '+' : ''}{calcMs.mcftrProfitPercent.toFixed(2)}%
                </span>
              </div>
              <div className={`px-2 py-0.5 rounded font-bold border ${
                calcMs.mcftrAlphaPercent > 0.9 ? 'bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/30'
                : calcMs.mcftrAlphaPercent >= 0.01 ? 'bg-amber-500/10 text-amber-600 dark:border-amber-500/30'
                : 'bg-rose-500/10 text-rose-600 dark:border-rose-500/30'
              }`}>
                {calcMs.mcftrAlphaPercent >= 0 ? '+' : ''}{calcMs.mcftrAlphaPercent.toFixed(2)}%
              </div>
            </div>
          )}

          <div className="flex items-center gap-0.5 border-l border-slate-200 dark:border-slate-700 pl-2">
            <button onClick={() => handleDuplicate(milestone)} className="p-1.5 text-slate-400 hover:text-sky-500" title="Дублировать"><Copy className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleEdit(milestone)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title="Редактировать"><Edit3 className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleDelete(milestone.id)} className="p-1.5 text-slate-400 hover:text-rose-500" title="Удалить"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      <button
        onClick={() => setIsAssetsOpen(!isAssetsOpen)}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 w-full pt-2 border-t border-slate-100 dark:border-slate-700/60 transition-colors"
      >
        {isAssetsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span>{isAssetsOpen ? 'Скрыть состав' : `Показать состав (${milestone.assets.length} акт.)`}</span>
        {!isAssetsOpen && freeCash > 0 && <span className="text-emerald-500 font-mono ml-auto">LQDT: {freeCash}%</span>}
      </button>

      {isAssetsOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-3 animate-in fade-in duration-200">
          {milestone.assets.map(asset => {
            const resolved = TickerResolver.resolveTicker(asset.ticker, milestone.date, settings.tickerRenames);
            const calcAsset = calcMs?.assets.find((a: any) => a.ticker === asset.ticker);

            return (
              <div key={asset.ticker} className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] space-y-1 font-mono">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold text-sky-500">{asset.ticker}</span>
                    {resolved !== asset.ticker && <span className="text-[9px] text-purple-400 block">({resolved})</span>}
                  </div>
                  <span className="font-semibold px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded">{asset.weight}%</span>
                </div>
                {calcAsset && (
                  <div className="space-y-0.5 text-[10px] text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-1">
                    <div className="flex justify-between">
                      <span>Цены:</span>
                      <span>{calcAsset.startPrice} → {calcAsset.finishPrice} ₽</span>
                    </div>
                    {calcAsset.rawDividends > 0 && (
                      <div className="flex justify-between text-emerald-500 font-semibold">
                        <span>Дивы:</span>
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
          {calcMs && freeCash > 0 && (
            <div className="p-2.5 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-[11px] space-y-1 font-mono">
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">LQDT (Кэш)</span>
                <span className="font-semibold px-1 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded">{freeCash.toFixed(2)}%</span>
              </div>
              <div className="space-y-0.5 text-[10px] text-slate-500 border-t border-emerald-500/20 pt-1">
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
      )}
    </div>
  );
};

export const PortfolioDetailView: React.FC = () => {
  const { 
    settings,
    openPortfolioMode,
    getSelectedPortfolio, 
    openPortfolio, 
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

  const [analyticsTab, setAnalyticsTab] = useState<'CHART' | 'MATRIX'>('CHART');
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(openPortfolioMode === 'analytics');
  const [isMilestonesOpen, setIsMilestonesOpen] = useState(openPortfolioMode === 'default');

  if (!portfolio) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Портфель не найден</p>
        <button onClick={() => openPortfolio(null)} className="mt-4 px-4 py-2 bg-sky-500 text-white rounded-xl text-sm">
          Вернуться на Дашборд
        </button>
      </div>
    );
  }

  const sortedMilestones = [...portfolio.milestones].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestMilestoneDateIso = sortedMilestones.length > 0 ? sortedMilestones[0].date : null;

  const handleOpenNewMilestone = () => {
    let prefilledAssets: IAssetAllocation[] = [];
    if (sortedMilestones.length > 0) prefilledAssets = sortedMilestones[0].assets.map(a => ({ ...a }));
    setEditingMilestone({ id: `new_${Date.now()}`, date: DateTimeStandardizer.toUTCISOString(new Date()), assets: prefilledAssets });
    setIsEditorOpen(true);
  };

  const handleSaveMilestone = (milestone: IMilestone) => {
    portfolio.milestones.some(m => m.id === milestone.id) ? updateMilestone(portfolio.id, milestone) : addMilestone(portfolio.id, milestone);
    setIsMilestonesOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => openPortfolio(null)} className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{portfolio.name}</h2>
              {portfolio.closedAt && <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 text-[10px] font-semibold rounded-md">Закрыт</span>}
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Создан: {DateTimeStandardizer.formatToLocalDisplay(portfolio.createdAt).split(' ')[0]}
              {result && result.totalDays > 0 && <span className="text-slate-500 font-semibold"> ({result.totalDays} дн.)</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => portfolio.closedAt ? closePortfolio(portfolio.id, null) : setIsCloseModalOpen(true)} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors ${portfolio.closedAt ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-200'}`}>
            {portfolio.closedAt ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span className="hidden sm:inline">{portfolio.closedAt ? 'Открыть' : 'Закрыть'}</span>
          </button>
          <button onClick={handleOpenNewMilestone} className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-medium text-sm rounded-xl shadow-sm transition-all">
            <CalendarPlus className="w-4 h-4" />
            <span>Добавить точку</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <button onClick={() => setIsAnalyticsOpen(!isAnalyticsOpen)} className="w-full flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-700 dark:text-slate-200">
            <ChartIcon className="w-4 h-4 text-sky-500" />
            <span>Аналитика и Финансовый результат</span>
          </div>
          {isAnalyticsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {isAnalyticsOpen && (
          loading ? (
            <div className="p-6 bg-white dark:bg-slate-800 border rounded-2xl flex items-center justify-center gap-3 text-slate-400 font-mono text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-sky-500" /><span>Загрузка данных...</span>
            </div>
          ) : result && portfolio.milestones.length > 0 ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
              <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">За {result.totalDays} дней</span>
                  <div className={`px-3 py-1 rounded-full border text-xs font-mono font-bold flex items-center gap-1.5 w-fit ${result.performanceColor === 'GREEN' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : result.performanceColor === 'YELLOW' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'bg-rose-500/10 text-rose-600 border-rose-500/30'}`}>
                    {result.alphaMonthlyPercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span>Альфа: {result.alphaMonthlyPercent >= 0 ? '+' : ''}{result.alphaMonthlyPercent.toFixed(2)}% / мес</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-sm">
                  <div><span className="text-[11px] text-slate-400 block">Общий профит:</span><span className={`text-base font-bold ${result.totalProfitPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{result.totalProfitPercent >= 0 ? '+' : ''}{result.totalProfitPercent.toFixed(2)}%</span></div>
                  <div><span className="text-[11px] text-slate-400 block">В месяц (CAGR):</span><span className={`text-base font-bold ${result.monthlyReturnPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{result.monthlyReturnPercent >= 0 ? '+' : ''}{result.monthlyReturnPercent.toFixed(2)}%</span></div>
                  <div><span className="text-[11px] text-slate-400 block">Годовая (CAGR):</span><span className={`text-base font-bold ${result.annualizedReturnPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{result.annualizedReturnPercent >= 0 ? '+' : ''}{result.annualizedReturnPercent.toFixed(2)}%</span></div>
                  <div><span className="text-[11px] text-slate-400 block">MCFTR (в мес):</span><span className={`text-base font-bold ${result.mcftrMonthlyReturnPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{result.mcftrMonthlyReturnPercent >= 0 ? '+' : ''}{result.mcftrMonthlyReturnPercent.toFixed(2)}%</span></div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit text-xs font-medium">
                  <button onClick={() => setAnalyticsTab('CHART')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${analyticsTab === 'CHART' ? 'bg-white dark:bg-slate-700 text-sky-600 font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><ChartIcon className="w-4 h-4" /><span className="hidden sm:inline">График</span></button>
                  <button onClick={() => setAnalyticsTab('MATRIX')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${analyticsTab === 'MATRIX' ? 'bg-white dark:bg-slate-700 text-sky-600 font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><CalendarDays className="w-4 h-4" /><span className="hidden sm:inline">По месяцам</span></button>
                </div>
                {analyticsTab === 'CHART' ? <PortfolioChart portfolio={portfolio} calculatedPortfolio={result} /> : <MonthlyReturnsMatrix portfolio={portfolio} />}
              </div>
            </div>
          ) : null
        )}
      </div>

      <div className="space-y-4">
        <button onClick={() => setIsMilestonesOpen(!isMilestonesOpen)} className="w-full flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-700 dark:text-slate-200">
            <Calendar className="w-4 h-4 text-sky-500" />
            <span>Контрольные точки ({portfolio.milestones.length})</span>
          </div>
          {isMilestonesOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {isMilestonesOpen && (
          sortedMilestones.length === 0 ? (
            <div className="border-2 border-dashed rounded-2xl p-10 text-center animate-in fade-in">
              <p className="text-sm text-slate-500 mb-4">Добавьте хотя бы одну точку для старта.</p>
              <button onClick={handleOpenNewMilestone} className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-white font-medium text-sm rounded-xl"><CalendarPlus className="w-4 h-4" /><span>Добавить</span></button>
            </div>
          ) : (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              {sortedMilestones.map((milestone, idx) => (
                <MilestoneItem
                  key={milestone.id}
                  milestone={milestone}
                  idx={idx}
                  totalLength={portfolio.milestones.length}
                  calcMs={result?.calculatedMilestones.find(m => m.milestoneId === milestone.id)}
                  settings={settings}
                  handleDuplicate={(m) => { setEditingMilestone({ id: `new_${Date.now()}`, date: m.date, assets: m.assets.map(a => ({...a})) }); setIsEditorOpen(true); }}
                  handleEdit={(m) => { setEditingMilestone(m); setIsEditorOpen(true); }}
                  handleDelete={(id) => deleteMilestone(portfolio.id, id)}
                />
              ))}
            </div>
          )
        )}
      </div>

      <MilestoneEditorModal isOpen={isEditorOpen} initialMilestone={editingMilestone} onSave={handleSaveMilestone} onClose={() => setIsEditorOpen(false)} />
      <ClosePortfolioModal isOpen={isCloseModalOpen} minDateIso={latestMilestoneDateIso} onConfirm={(iso) => closePortfolio(portfolio.id, iso)} onClose={() => setIsCloseModalOpen(false)} />
    </div>
  );
};