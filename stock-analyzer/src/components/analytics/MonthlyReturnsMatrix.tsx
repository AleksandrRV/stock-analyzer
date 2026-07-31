import React, { useState, useEffect } from 'react';
import { IPortfolio } from '../../types/domain';
import { PortfolioCalculationService, IMonthlyMatrixRow } from '../../services/engine/PortfolioCalculationService';
import { CalendarDays, Loader2, HelpCircle } from 'lucide-react';

interface Props {
  portfolio: IPortfolio;
}

export const MonthlyReturnsMatrix: React.FC<Props> = ({ portfolio }) => {
  const [matrixRows, setMatrixRows] = useState<IMonthlyMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    PortfolioCalculationService.calculateMonthlyReturnsMatrix(portfolio)
      .then(rows => {
        if (isMounted) {
          setMatrixRows(rows);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Error calculating monthly matrix:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [portfolio]);

  if (loading) {
    return (
      <div className="p-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex flex-col items-center justify-center gap-2 text-xs font-mono text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
        <span>Загрузка котировок и расчет трех показателей по каждому месяцу...</span>
      </div>
    );
  }

  if (matrixRows.length === 0) {
    return (
      <div className="p-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-center text-slate-400 text-xs font-mono">
        Нет данных для построения матрицы. Добавьте хотя бы одну контрольную точку.
      </div>
    );
  }

  // Стили бейджей Альфы
  const getAlphaStyle = (alpha: number | null) => {
    if (alpha === null) return 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700';
    if (alpha > 0.9) {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    }
    if (alpha >= 0.01) {
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    }
    return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 space-y-6 shadow-sm">
      
      {/* ШАПКА И ЛЕГЕНДА */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
        <div className="flex items-center gap-2 font-bold text-sm">
          <CalendarDays className="w-4 h-4 text-sky-500" />
          <span>Адаптивная матрица доходностей по месяцах (%)</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono flex-wrap">
          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-800 dark:text-slate-200">Альфа</span>
            <span>— Крупно</span>
          </div>
          <span>&bull;</span>
          <div className="flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>* Неполный месяц</span>
          </div>
        </div>
      </div>

      {/* РАЗБИЕНИЕ ПО ГОДАМ */}
      <div className="space-y-6">
        {matrixRows.map(row => {
          const activeMonths = row.months.filter(m => m.portfolioReturn !== null);

          return (
            <div key={row.year} className="space-y-3 p-4 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
              
              {/* БАННЕР ГОДА И ИТОГОВЫХ ПОКАЗАТЕЛЕЙ ЗА ГОД */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">{row.year} год</span>
                  <span className="text-xs text-slate-400 font-mono">({activeMonths.length} мес.)</span>
                </div>

                {/* Итого за год */}
                {row.yearPortfolioReturn !== null && row.yearAlpha !== null && (
                  <div className="flex items-center gap-3 text-xs font-mono bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Портфель:</span>
                      <span className={`font-bold ${row.yearPortfolioReturn >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {row.yearPortfolioReturn >= 0 ? '+' : ''}{row.yearPortfolioReturn}%
                      </span>
                    </div>

                    <div className="border-l border-slate-200 dark:border-slate-700 pl-3">
                      <span className="text-slate-400 block text-[10px]">MCFTR:</span>
                      <span className={`font-bold ${row.yearMcftrReturn! >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {row.yearMcftrReturn! >= 0 ? '+' : ''}{row.yearMcftrReturn}%
                      </span>
                    </div>

                    <div className={`px-2.5 py-1 rounded-lg border font-bold flex flex-col items-end ${getAlphaStyle(row.yearAlpha)}`}>
                      <span className="text-[9px] uppercase tracking-wider opacity-75">Альфа за год:</span>
                      <span>{row.yearAlpha >= 0 ? '+' : ''}{row.yearAlpha}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* АДАПТИВНАЯ СЕТКА КАРТОЧЕК МЕСЯЦЕВ (Минимальная ширина каждой карточки: 105px) */}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(105px,1fr))] gap-2.5">
                {row.months.map((cell, idx) => {
                  if (cell.portfolioReturn === null || cell.alpha === null) {
                    return (
                      <div
                        key={idx}
                        className="p-2.5 bg-white/40 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60 rounded-xl text-center text-slate-300 dark:text-slate-700 text-xs font-mono flex flex-col justify-center items-center min-h-[86px]"
                      >
                        <span className="text-[10px] text-slate-400 block mb-1">{cell.monthName}</span>
                        <span>&mdash;</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between space-y-1.5 transition-all shadow-xs ${getAlphaStyle(cell.alpha)}`}
                      title={`Период: ${cell.startDateDisplay} — ${cell.finishDateDisplay}\n` +
                        `Портфель: ${cell.portfolioReturn >= 0 ? '+' : ''}${cell.portfolioReturn}%\n` +
                        `MCFTR: ${cell.mcftrReturn! >= 0 ? '+' : ''}${cell.mcftrReturn}%\n` +
                        `Альфа: ${cell.alpha >= 0 ? '+' : ''}${cell.alpha}%` +
                        (cell.isPartial ? '\n(Неполный месяц)' : '')
                      }
                    >
                      {/* Месяц + Иконка неполного месяца */}
                      <div className="flex items-center justify-between text-xs font-semibold font-mono opacity-80 border-b border-current/15 pb-1">
                        <span>{cell.monthName}</span>
                        {cell.isPartial && (
                          <span className="text-amber-500 font-bold" title="Неполный месяц">*</span>
                        )}
                      </div>

                      {/* Альфа за месяц (Крупно) */}
                      <div className="text-sm font-bold font-mono tracking-tight my-0.5 whitespace-nowrap">
                        {cell.alpha >= 0 ? '+' : ''}{cell.alpha}%
                      </div>

                      {/* Подписи: Портф и MCFTR */}
                      <div className="text-[10px] font-mono space-y-0.5 border-t border-current/15 pt-1">
                        <div className="flex justify-between items-center whitespace-nowrap gap-1">
                          <span className="opacity-75">Портф:</span>
                          <span className="font-bold">{cell.portfolioReturn >= 0 ? '+' : ''}{cell.portfolioReturn}%</span>
                        </div>
                        <div className="flex justify-between items-center whitespace-nowrap gap-1">
                          <span className="opacity-75">MCFTR:</span>
                          <span className="font-bold">{cell.mcftrReturn! >= 0 ? '+' : ''}{cell.mcftrReturn}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};