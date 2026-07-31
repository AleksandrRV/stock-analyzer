import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ICalculatedPortfolio, IEquityChartPoint, PortfolioCalculationService } from '../../services/engine/PortfolioCalculationService';
import { DateTimeStandardizer } from '../../engine/DateTimeStandardizer';
import { IPortfolio } from '../../types/domain';
import { APP_CONFIG } from '../../constants/config';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

import { LineChart as ChartIcon, Calendar, Loader2, CalendarRange } from 'lucide-react';

export type TimeFilter = '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'ALL' | 'CUSTOM';

interface Props {
  portfolio: IPortfolio;
  calculatedPortfolio: ICalculatedPortfolio;
}

export const PortfolioChart: React.FC<Props> = ({ portfolio, calculatedPortfolio }) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
  const [chartPoints, setChartPoints] = useState<IEquityChartPoint[]>(calculatedPortfolio.chartPoints || []);
  const [showSpinner, setShowSpinner] = useState(false);

  const [customStart, setCustomStart] = useState('');
  const [customFinish, setCustomFinish] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const getExactDateMonthsAgo = (baseDate: Date, monthsAgo: number): Date => {
    const d = new Date(baseDate);
    const targetMonth = d.getMonth() - monthsAgo;
    d.setMonth(targetMonth);
    if (d.getMonth() > (targetMonth + 1200) % 12) {
      d.setDate(0);
    }
    return d;
  };

  // Пересчет кривой с задержкой появления спиннера (от дерганий)
  const updateChartRange = useCallback(async (filter: TimeFilter, startOverride?: string, finishOverride?: string) => {
    // Включаем таймер на появление спиннера
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowSpinner(true);
    }, APP_CONFIG.LOADING_SPINNER_DELAY_MS);

    const portfolioStartIso = calculatedPortfolio.startDateIso;
    const portfolioFinishIso = calculatedPortfolio.finishDateIso;

    if (!portfolioStartIso || !portfolioFinishIso) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setShowSpinner(false);
      return;
    }

    let targetStartIso = portfolioStartIso;
    let targetFinishIso = portfolioFinishIso;

    const finishDate = new Date(portfolioFinishIso);

    if (filter === 'CUSTOM' && startOverride && finishOverride) {
      targetStartIso = DateTimeStandardizer.toUTCISOString(new Date(startOverride));
      targetFinishIso = DateTimeStandardizer.toUTCISOString(new Date(finishOverride));
    } else if (filter !== 'ALL') {
      let calcStartDate = new Date(finishDate);

      switch (filter) {
        case '1M':
          calcStartDate = getExactDateMonthsAgo(finishDate, 1);
          break;
        case '3M':
          calcStartDate = getExactDateMonthsAgo(finishDate, 3);
          break;
        case '6M':
          calcStartDate = getExactDateMonthsAgo(finishDate, 6);
          break;
        case '1Y':
          calcStartDate = getExactDateMonthsAgo(finishDate, 12);
          break;
        case 'YTD':
          calcStartDate = new Date(Date.UTC(finishDate.getUTCFullYear(), 0, 1, 0, 0, 0));
          break;
      }

      if (calcStartDate.getTime() < new Date(portfolioStartIso).getTime()) {
        targetStartIso = portfolioStartIso;
      } else {
        targetStartIso = DateTimeStandardizer.toUTCISOString(calcStartDate);
      }
    }

    const points = await PortfolioCalculationService.calculateChartCurveForRange(
      portfolio,
      targetStartIso,
      targetFinishIso
    );

    // Сбрасываем таймер и скрываем спиннер
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowSpinner(false);

    // Обновляем точки бесшовно
    setChartPoints(points);
  }, [portfolio, calculatedPortfolio]);

  const handleFilterChange = (filter: TimeFilter) => {
    setTimeFilter(filter);
    if (filter !== 'CUSTOM') {
      updateChartRange(filter);
    }
  };

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart && customFinish) {
      updateChartRange('CUSTOM', customStart, customFinish);
    }
  };

  useEffect(() => {
    setChartPoints(calculatedPortfolio.chartPoints || []);
  }, [calculatedPortfolio]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: IEquityChartPoint = payload[0].payload;
      return (
        <div className="bg-slate-900/95 text-white p-3.5 rounded-xl border border-slate-700 shadow-xl text-xs space-y-2 font-mono backdrop-blur-md">
          <div className="text-slate-400 font-semibold border-b border-slate-800 pb-1.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>{data.dateDisplay}</span>
            </div>
            <span className={`px-1.5 py-0.5 text-[10px] rounded font-bold ${
              data.type === 'START' ? 'bg-amber-500/20 text-amber-400' :
              data.type === 'MILESTONE' ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-400'
            }`}>
              {data.type === 'START' ? 'Старт периода (0.00%)' :
               data.type === 'MILESTONE' ? 'Контрольная точка' : 'Конец месяца'}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-sky-400 font-medium">Портфель:</span>
            <span className="font-bold">{data.portfolioReturn >= 0 ? '+' : ''}{data.portfolioReturn}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-emerald-400 font-medium">MCFTR:</span>
            <span className="font-bold">{data.mcftrReturn >= 0 ? '+' : ''}{data.mcftrReturn}%</span>
          </div>
          <div className="flex justify-between gap-4 pt-1.5 border-t border-slate-800 font-bold">
            <span>Альфа:</span>
            <span className={data.alpha >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {data.alpha >= 0 ? '+' : ''}{data.alpha}%
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-sm relative overflow-hidden">
      
      {/* СПИННЕР ПОЯВЛЯЕТСЯ ТОЛЬКО ПРИ ДОЛГОЙ ЗАГРУЗКЕ (> 300мс) */}
      {showSpinner && (
        <div className="absolute inset-0 z-20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center gap-2 text-xs font-mono text-slate-500 animate-in fade-in">
          <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
          <span>Пересчет котировок за период...</span>
        </div>
      )}

      {/* ШАПКА ГРАФИКА */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
        <div className="flex items-center gap-2 font-bold text-sm">
          <ChartIcon className="w-4 h-4 text-sky-500" />
          <span>Кривая доходности (Базлайн: 0.00%)</span>
        </div>

        {/* Таймфреймы */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-xs font-mono overflow-x-auto">
          {(['1M', '3M', '6M', '1Y', 'YTD', 'ALL', 'CUSTOM'] as TimeFilter[]).map(filter => (
            <button
              key={filter}
              onClick={() => handleFilterChange(filter)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap ${
                timeFilter === filter
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {filter === 'ALL' ? 'Всё время' : filter === 'CUSTOM' ? 'Свой период' : filter}
            </button>
          ))}
        </div>
      </div>

      {/* ПОЛЕ ВЫБОРА СВОЕГО ПЕРИОДА */}
      {timeFilter === 'CUSTOM' && (
        <form onSubmit={handleApplyCustomRange} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex flex-wrap items-end gap-3 text-xs font-mono animate-in fade-in">
          <div className="space-y-1">
            <span className="text-slate-400 block">Старт периода:</span>
            <input
              type="datetime-local"
              required
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="p-1.5 bg-white dark:bg-slate-800 border rounded-lg"
            />
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 block">Финиш периода:</span>
            <input
              type="datetime-local"
              required
              value={customFinish}
              onChange={e => setCustomFinish(e.target.value)}
              className="p-1.5 bg-white dark:bg-slate-800 border rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg flex items-center gap-1"
          >
            <CalendarRange className="w-3.5 h-3.5" />
            <span>Применить</span>
          </button>
        </form>
      )}

      {chartPoints.length <= 1 ? (
        <div className="p-8 text-center text-slate-400 text-xs">
          Недостаточно данных за выбранный период.
        </div>
      ) : (
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
              
              {/* ПРОПОРЦИОНАЛЬНАЯ ОСЬ X ПО ВРЕМЕНИ (type="number" + scale="time") */}
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={timestamp => {
                  const d = new Date(timestamp);
                  const day = String(d.getDate()).padStart(2, '0');
                  const month = String(d.getMonth() + 1).padStart(2, '0');
                  const year = String(d.getFullYear()).slice(-2);
                  return `${day}.${month}.${year}`;
                }}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: '#334155', opacity: 0.3 }}
              />
              
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={val => `${val}%`}
                tickLine={false}
                axisLine={{ stroke: '#334155', opacity: 0.3 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                formatter={value => (value === 'portfolioReturn' ? 'Портфель (%)' : 'Индекс MCFTR (%)')}
              />
              <Line
                type="monotone"
                dataKey="portfolioReturn"
                name="portfolioReturn"
                stroke="#0284c7"
                strokeWidth={3}
                dot={props => {
                  const { cx, cy, payload } = props;
                  const isMs = payload.type === 'MILESTONE' || payload.type === 'START';
                  return (
                    <circle
                      key={`${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={isMs ? 5 : 3}
                      fill={isMs ? '#0284c7' : '#38bdf8'}
                      stroke="#ffffff"
                      strokeWidth={isMs ? 2 : 1}
                    />
                  );
                }}
                activeDot={{ r: 7 }}
              />
              <Line
                type="monotone"
                dataKey="mcftrReturn"
                name="mcftrReturn"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 2, fill: '#10b981' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};