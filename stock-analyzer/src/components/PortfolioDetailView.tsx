import React, { useState } from 'react';
import { usePortfolioStore } from '../store/usePortfolioStore';
import { IMilestone } from '../types/domain';
import { DateTimeStandardizer } from '../engine/DateTimeStandardizer';
import { TickerResolver } from '../engine/TickerResolver';
import { MilestoneEditorModal } from './milestones/MilestoneEditorModal';

import { 
  ArrowLeft, 
  CalendarPlus, 
  Calendar, 
  Trash2, 
  Edit3, 
  Copy, 
  Lock, 
  Unlock, 
  Clock
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

  // Редактирование контрольной точки
  const [isEditorOpen, setIsEditorOpen] = useState(false);
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

  // Сортировка контрольных точек В ОБРАТНОМ ПОРЯДКЕ (новые/свежие — сверху)
  const sortedMilestones = [...portfolio.milestones].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // СОЗДАНИЕ НОВОЙ ТОЧКИ: Берем состав последней точки, а дату — ТЕКУЩУЮ
  const handleOpenNewMilestone = () => {
    let prefilledAssets = [];

    if (sortedMilestones.length > 0) {
      prefilledAssets = sortedMilestones[0].assets.map(a => ({ ...a }));
    }

    const nowIso = DateTimeStandardizer.toUTCISOString(new Date());

    setEditingMilestone({
      id: `new_${Date.now()}`,
      date: nowIso, // Актуальная текущая дата
      assets: prefilledAssets,
    });
    setIsEditorOpen(true);
  };

  // КЛОНИРОВАНИЕ / ДУБЛИРОВАНИЕ ТОЧКИ: Копируем И состав, И исходные ДАТУ/ЧАС
  const handleDuplicateMilestone = (sourceMilestone: IMilestone) => {
    setEditingMilestone({
      id: `new_${Date.now()}`,
      date: sourceMilestone.date, // ИСХОДНАЯ ДАТА И ЧАС ТОЧКИ
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
      closePortfolio(portfolio.id, null);
    } else {
      const nowIso = new Date().toISOString();
      closePortfolio(portfolio.id, nowIso);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* КНОПКА НАЗАД И ШАПКА ПОРТФЕЛЯ */}
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
                  Закрыт
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Создан: {DateTimeStandardizer.formatToLocalDisplay(portfolio.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Переключатель "Закрыть портфель" */}
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

          {/* Добавить контрольную точку */}
          <button
            onClick={handleOpenNewMilestone}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-medium text-sm rounded-xl shadow-sm transition-all"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Добавить точку</span>
          </button>
        </div>
      </div>

      {/* СПИСОК КОНТРОЛЬНЫХ ТОЧЕК (Свежие сверху) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Контрольные точки ({portfolio.milestones.length})</h3>
          <span className="text-xs text-slate-400">Самые новые — сверху</span>
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
              const allocatedSum = milestone.assets.reduce((sum, a) => sum + Number(a.weight), 0);
              const freeCash = Math.max(0, Math.round((100 - allocatedSum) * 100) / 100);

              const chronologicalIndex = portfolio.milestones.length - idx;

              return (
                <div
                  key={milestone.id}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/70 rounded-2xl p-5 space-y-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-sky-500/10 text-sky-500 rounded-xl font-mono text-xs font-bold">
                        #{chronologicalIndex}
                      </div>
                      <div>
                        <div className="font-bold font-mono text-base flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>{DateTimeStandardizer.formatToLocalDisplay(milestone.date)}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">UTC: {milestone.date}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Кнопка Дублировать */}
                      <button
                        onClick={() => handleDuplicateMilestone(milestone)}
                        className="p-1.5 text-slate-400 hover:text-sky-500 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors"
                        title="Скопировать / Создать на основе этой точки"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      {/* Кнопка Редактировать */}
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

                      {/* Кнопка Удалить */}
                      <button
                        onClick={() => deleteMilestone(portfolio.id, milestone.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Удалить точку"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* СОСТАВ БУМАГ В ТОЧКЕ */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {milestone.assets.map(asset => {
                      const resolved = TickerResolver.resolveTicker(asset.ticker, milestone.date);
                      return (
                        <div
                          key={asset.ticker}
                          className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs flex justify-between items-center"
                        >
                          <div>
                            <span className="font-bold font-mono text-sky-500">{asset.ticker}</span>
                            {resolved !== asset.ticker && (
                              <span className="text-[10px] text-purple-400 block font-mono">({resolved})</span>
                            )}
                          </div>
                          <span className="font-mono font-semibold">{asset.weight}%</span>
                        </div>
                      );
                    })}

                    {/* Свободный кэш (LQDT) */}
                    {freeCash > 0 && (
                      <div className="p-2.5 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-xs flex justify-between items-center">
                        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">LQDT (Кэш)</span>
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {freeCash.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Модалка редактора */}
      <MilestoneEditorModal
        isOpen={isEditorOpen}
        initialMilestone={editingMilestone}
        onSave={handleSaveMilestone}
        onClose={() => setIsEditorOpen(false)}
      />
    </div>
  );
};