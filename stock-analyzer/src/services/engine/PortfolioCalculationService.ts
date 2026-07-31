import { IPortfolio, AssetType } from '../../types/domain';
import { MarketDataSyncService } from '../sync/MarketDataSyncService';
import { FinancialMath } from '../../engine/FinancialMath';
import { DateTimeStandardizer } from '../../engine/DateTimeStandardizer';
import { TickerResolver } from '../../engine/TickerResolver';
import { UserStorage } from '../storage/userStorage';

// Данные по одному месяцу
export interface IMonthlyMatrixCell {
  monthIndex: number; // 0..11
  monthName: string;  // 'Янв', 'Фев'...
  portfolioReturn: number | null; // null если портфель не существовал
  mcftrReturn: number | null;
  alpha: number | null;
  isPartial: boolean; // Признак неполного месяца
  startDateDisplay: string;
  finishDateDisplay: string;
}

// Строка таблицы (Один календарный год)
export interface IMonthlyMatrixRow {
  year: number;
  months: IMonthlyMatrixCell[];
  yearPortfolioReturn: number | null;
  yearMcftrReturn: number | null;
  yearAlpha: number | null;
}

export interface ICalculatedAsset {
  ticker: string;
  resolvedTicker: string;
  weight: number;
  type: AssetType;
  startPrice: number;
  finishPrice: number;
  rawDividends: number;
  netDividends: number;
  profitPercent: number;
}

export interface ICalculatedMilestone {
  milestoneId: string;
  startDateIso: string;
  finishDateIso: string;
  durationHours: number;
  durationDays: number;
  assets: ICalculatedAsset[];
  freeCashWeight: number;
  lqdtStartPrice: number;
  lqdtFinishPrice: number;
  lqdtProfitPercent: number;
  totalProfitPercent: number;
  mcftrStartPrice: number;
  mcftrFinishPrice: number;
  mcftrProfitPercent: number;
  mcftrAlphaPercent: number;
}

export interface IEquityChartPoint {
  dateIso: string;
  dateDisplay: string;
  timestamp: number; // Временная метка в мс для точного масштабирования оси X
  type: 'START' | 'MILESTONE' | 'MONTH_END' | 'FINISH';
  portfolioReturn: number;
  mcftrReturn: number;
  alpha: number;
}

export interface ICalculatedPortfolio {
  portfolioId: string;
  startDateIso: string;
  finishDateIso: string;
  totalDays: number;
  calculatedMilestones: ICalculatedMilestone[];
  chartPoints: IEquityChartPoint[];
  totalProfitPercent: number;
  monthlyReturnPercent: number;
  annualizedReturnPercent: number;
  
  mcftrStartPrice: number;
  mcftrFinishPrice: number;
  mcftrTotalProfitPercent: number;
  mcftrMonthlyReturnPercent: number;
  
  alphaMonthlyPercent: number;
  performanceColor: 'RED' | 'YELLOW' | 'GREEN';
  isLoading: boolean;
  error: string | null;
}

export class PortfolioCalculationService {
  private static getMonthEndDatesBetween(startIso: string, endIso: string): string[] {
    const result: string[] = [];
    const start = new Date(startIso);
    const end = new Date(endIso);

    let current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 0, 0));

    while (current.getTime() < end.getTime()) {
      if (current.getTime() > start.getTime()) {
        result.push(current.toISOString());
      }
      current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 2, 0, 23, 0, 0));
    }

    return result;
  }

  static async calculateChartCurveForRange(
    portfolio: IPortfolio,
    rangeStartIso: string,
    rangeFinishIso: string
  ): Promise<IEquityChartPoint[]> {
    const taxRate = UserStorage.getSettings().dividendTaxRate || 15;
    if (!portfolio.milestones || portfolio.milestones.length === 0) return [];

    const milestonesAsc = [...portfolio.milestones].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const rangeStartTime = new Date(rangeStartIso).getTime();
    const rangeFinishTime = new Date(rangeFinishIso).getTime();

    const internalMilestoneDates = milestonesAsc
      .map(m => m.date)
      .filter(d => new Date(d).getTime() > rangeStartTime && new Date(d).getTime() < rangeFinishTime);

    const monthEnds = this.getMonthEndDatesBetween(rangeStartIso, rangeFinishIso);

    const allTimelineDates = Array.from(
      new Set([rangeStartIso, ...internalMilestoneDates, ...monthEnds, rangeFinishIso])
    ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const chartPoints: IEquityChartPoint[] = [];
    let cumPortfolioMult = 1.0;
    let cumMcftrMult = 1.0;

    chartPoints.push({
      dateIso: rangeStartIso,
      dateDisplay: DateTimeStandardizer.formatToLocalDisplay(rangeStartIso).split(' ')[0],
      timestamp: rangeStartTime,
      type: 'START',
      portfolioReturn: 0,
      mcftrReturn: 0,
      alpha: 0,
    });

    for (let i = 0; i < allTimelineDates.length - 1; i++) {
      const subStartIso = allTimelineDates[i];
      const subFinishIso = allTimelineDates[i + 1];

      const subStartTime = new Date(subStartIso).getTime();
      let activeMs = milestonesAsc[0];

      for (const ms of milestonesAsc) {
        if (new Date(ms.date).getTime() <= subStartTime) {
          activeMs = ms;
        } else {
          break;
        }
      }

      let subWeightedProfit = 0;
      let subTotalWeight = 0;

      for (const asset of activeMs.assets) {
        const resolved = TickerResolver.resolveTicker(asset.ticker, subStartIso);
        subTotalWeight += Number(asset.weight) || 0;

        const pStart = await MarketDataSyncService.getOrFetchPrice(resolved, subStartIso);
        const pFinish = await MarketDataSyncService.getOrFetchPrice(resolved, subFinishIso);

        const p1 = pStart?.price || 0;
        const p2 = pFinish?.price || 0;

        if (p1 > 0) {
          let divs = 0;
          if (asset.type === 'STOCK') {
            const allD = await MarketDataSyncService.getOrFetchDividends(resolved);
            const d1 = DateTimeStandardizer.toMSKDateString(subStartIso);
            const d2 = DateTimeStandardizer.toMSKDateString(subFinishIso);
            divs = allD.filter(d => d.date >= d1 && d.date <= d2).reduce((s, d) => s + Number(d.value), 0) * (1 - taxRate / 100);
          }
          const pPct = ((p2 + divs - p1) / p1) * 100;
          subWeightedProfit += pPct * (asset.weight / 100);
        }
      }

      const freeCashW = Math.max(0, Math.round((100 - subTotalWeight) * 100) / 100);
      if (freeCashW > 0) {
        const l1 = await MarketDataSyncService.getOrFetchPrice('LQDT', subStartIso);
        const l2 = await MarketDataSyncService.getOrFetchPrice('LQDT', subFinishIso);
        const lq1 = l1?.price || 0;
        const lq2 = l2?.price || 0;
        if (lq1 > 0) {
          const lqPct = ((lq2 - lq1) / lq1) * 100;
          subWeightedProfit += lqPct * (freeCashW / 100);
        }
      }

      const m1 = await MarketDataSyncService.getOrFetchMCFTR(subStartIso);
      const m2 = await MarketDataSyncService.getOrFetchMCFTR(subFinishIso);
      const mc1 = m1?.price || 0;
      const mc2 = m2?.price || 0;
      let subMcftrPct = 0;
      if (mc1 > 0) {
        subMcftrPct = ((mc2 - mc1) / mc1) * 100;
      }

      cumPortfolioMult *= (1 + subWeightedProfit / 100);
      cumMcftrMult *= (1 + subMcftrPct / 100);

      const cumP = (cumPortfolioMult - 1) * 100;
      const cumM = (cumMcftrMult - 1) * 100;

      const isMs = internalMilestoneDates.includes(subFinishIso);
      const isFinish = subFinishIso === rangeFinishIso;

      chartPoints.push({
        dateIso: subFinishIso,
        dateDisplay: DateTimeStandardizer.formatToLocalDisplay(subFinishIso).split(' ')[0],
        timestamp: new Date(subFinishIso).getTime(),
        type: isFinish ? 'FINISH' : isMs ? 'MILESTONE' : 'MONTH_END',
        portfolioReturn: Number(cumP.toFixed(2)),
        mcftrReturn: Number(cumM.toFixed(2)),
        alpha: Number((cumP - cumM).toFixed(2)),
      });
    }

    return chartPoints;
  }

  static async calculatePortfolio(portfolio: IPortfolio): Promise<ICalculatedPortfolio> {
    const taxRate = UserStorage.getSettings().dividendTaxRate || 15;

    if (!portfolio.milestones || portfolio.milestones.length === 0) {
      return this.getEmptyResult(portfolio.id);
    }

    const milestonesAsc = [...portfolio.milestones].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const startDateIso = milestonesAsc[0].date;
    const nowIso = DateTimeStandardizer.toUTCISOString(new Date());
    const finishDateIso = portfolio.closedAt || nowIso;

    const startDate = new Date(startDateIso);
    const finishDate = new Date(finishDateIso);
    const totalDays = Math.max(1, Math.round((finishDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    const calculatedMilestones: ICalculatedMilestone[] = [];
    const milestoneReturns: number[] = [];

    for (let i = 0; i < milestonesAsc.length; i++) {
      const currentMs = milestonesAsc[i];
      const msStartIso = currentMs.date;
      
      let msFinishIso = finishDateIso;
      if (i + 1 < milestonesAsc.length) {
        msFinishIso = milestonesAsc[i + 1].date;
      }

      const msStartDate = new Date(msStartIso);
      const msFinishDate = new Date(msFinishIso);
      const durationHours = Math.max(1, Math.round((msFinishDate.getTime() - msStartDate.getTime()) / (1000 * 60 * 60)));
      const durationDays = Math.round(durationHours / 24);

      const msStartDateStr = DateTimeStandardizer.toMSKDateString(msStartIso);
      const msFinishDateStr = DateTimeStandardizer.toMSKDateString(msFinishIso);

      const calculatedAssets: ICalculatedAsset[] = [];
      let totalAllocatedWeight = 0;
      let msWeightedProfitSum = 0;

      for (const asset of currentMs.assets) {
        const resolved = TickerResolver.resolveTicker(asset.ticker, msStartIso);
        totalAllocatedWeight += Number(asset.weight) || 0;

        const startRes = await MarketDataSyncService.getOrFetchPrice(resolved, msStartIso);
        const finishRes = await MarketDataSyncService.getOrFetchPrice(resolved, msFinishIso);

        const startPrice = startRes?.price || 0;
        const finishPrice = finishRes?.price || 0;

        let rawDividends = 0;
        let netDividends = 0;

        if (asset.type === 'STOCK') {
          const allDivs = await MarketDataSyncService.getOrFetchDividends(resolved);
          const periodDivs = allDivs.filter(d => d.date >= msStartDateStr && d.date <= msFinishDateStr);
          rawDividends = periodDivs.reduce((sum, d) => sum + Number(d.value), 0);
          netDividends = rawDividends * (1 - taxRate / 100);
        }

        const profitPercent = startPrice > 0 
          ? FinancialMath.calculateStockProfit(startPrice, finishPrice, rawDividends, taxRate)
          : 0;

        calculatedAssets.push({
          ticker: asset.ticker,
          resolvedTicker: resolved,
          weight: asset.weight,
          type: asset.type,
          startPrice,
          finishPrice,
          rawDividends,
          netDividends,
          profitPercent,
        });

        msWeightedProfitSum += profitPercent * (asset.weight / 100);
      }

      const freeCashWeight = Math.max(0, Math.round((100 - totalAllocatedWeight) * 100) / 100);
      let lqdtStartPrice = 0;
      let lqdtFinishPrice = 0;
      let lqdtProfitPercent = 0;

      if (freeCashWeight > 0) {
        const lqdtStart = await MarketDataSyncService.getOrFetchPrice('LQDT', msStartIso);
        const lqdtFinish = await MarketDataSyncService.getOrFetchPrice('LQDT', msFinishIso);

        lqdtStartPrice = lqdtStart?.price || 0;
        lqdtFinishPrice = lqdtFinish?.price || 0;

        if (lqdtStartPrice > 0) {
          lqdtProfitPercent = ((lqdtFinishPrice - lqdtStartPrice) / lqdtStartPrice) * 100;
        }

        msWeightedProfitSum += lqdtProfitPercent * (freeCashWeight / 100);
      }

      const msMcftrStart = await MarketDataSyncService.getOrFetchMCFTR(msStartIso);
      const msMcftrFinish = await MarketDataSyncService.getOrFetchMCFTR(msFinishIso);

      const mcftrStartPrice = msMcftrStart?.price || 0;
      const mcftrFinishPrice = msMcftrFinish?.price || 0;
      let mcftrProfitPercent = 0;

      if (mcftrStartPrice > 0) {
        mcftrProfitPercent = ((mcftrFinishPrice - mcftrStartPrice) / mcftrStartPrice) * 100;
      }

      const mcftrAlphaPercent = msWeightedProfitSum - mcftrProfitPercent;

      calculatedMilestones.push({
        milestoneId: currentMs.id,
        startDateIso: msStartIso,
        finishDateIso: msFinishIso,
        durationHours,
        durationDays,
        assets: calculatedAssets,
        freeCashWeight,
        lqdtStartPrice,
        lqdtFinishPrice,
        lqdtProfitPercent,
        totalProfitPercent: msWeightedProfitSum,
        mcftrStartPrice,
        mcftrFinishPrice,
        mcftrProfitPercent,
        mcftrAlphaPercent,
      });

      milestoneReturns.push(msWeightedProfitSum);
    }

    const chartPoints = await this.calculateChartCurveForRange(portfolio, startDateIso, finishDateIso);

    const totalProfitPercent = FinancialMath.calculateCompoundReturn(milestoneReturns);
    const monthlyReturnPercent = FinancialMath.calculateMonthlyRate(totalProfitPercent, totalDays);
    const annualizedReturnPercent = FinancialMath.calculateAnnualizedRate(monthlyReturnPercent);

    const mcftrStart = await MarketDataSyncService.getOrFetchMCFTR(startDateIso);
    const mcftrFinish = await MarketDataSyncService.getOrFetchMCFTR(finishDateIso);

    const mcftrStartPrice = mcftrStart?.price || 0;
    const mcftrFinishPrice = mcftrFinish?.price || 0;

    let mcftrTotalProfitPercent = 0;
    let mcftrMonthlyReturnPercent = 0;

    if (mcftrStartPrice > 0) {
      mcftrTotalProfitPercent = ((mcftrFinishPrice - mcftrStartPrice) / mcftrStartPrice) * 100;
      mcftrMonthlyReturnPercent = FinancialMath.calculateMonthlyRate(mcftrTotalProfitPercent, totalDays);
    }

    const alphaMonthlyPercent = FinancialMath.calculateAlpha(monthlyReturnPercent, mcftrMonthlyReturnPercent);

    let performanceColor: 'RED' | 'YELLOW' | 'GREEN' = 'RED';
    if (alphaMonthlyPercent > 0.9) {
      performanceColor = 'GREEN';
    } else if (alphaMonthlyPercent >= 0.01) {
      performanceColor = 'YELLOW';
    }

    return {
      portfolioId: portfolio.id,
      startDateIso,
      finishDateIso,
      totalDays,
      calculatedMilestones,
      chartPoints,
      totalProfitPercent,
      monthlyReturnPercent,
      annualizedReturnPercent,
      mcftrStartPrice,
      mcftrFinishPrice,
      mcftrTotalProfitPercent,
      mcftrMonthlyReturnPercent,
      alphaMonthlyPercent,
      performanceColor,
      isLoading: false,
      error: null,
    };
  }

  private static getEmptyResult(portfolioId: string): ICalculatedPortfolio {
    return {
      portfolioId,
      startDateIso: '',
      finishDateIso: '',
      totalDays: 0,
      calculatedMilestones: [],
      chartPoints: [],
      totalProfitPercent: 0,
      monthlyReturnPercent: 0,
      annualizedReturnPercent: 0,
      mcftrStartPrice: 0,
      mcftrFinishPrice: 0,
      mcftrTotalProfitPercent: 0,
      mcftrMonthlyReturnPercent: 0,
      alphaMonthlyPercent: 0,
      performanceColor: 'RED',
      isLoading: false,
      error: null,
    };
  }

  /**
   * Рассчитывает матрицу доходностей строго по календарным месяцам для каждого года
   */
  static async calculateMonthlyReturnsMatrix(portfolio: IPortfolio): Promise<IMonthlyMatrixRow[]> {
    const taxRate = UserStorage.getSettings().dividendTaxRate || 15;

    if (!portfolio.milestones || portfolio.milestones.length === 0) return [];

    const milestonesAsc = [...portfolio.milestones].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const startDateIso = milestonesAsc[0].date;
    const nowIso = DateTimeStandardizer.toUTCISOString(new Date());
    const finishDateIso = portfolio.closedAt || nowIso;

    const startDate = new Date(startDateIso);
    const finishDate = new Date(finishDateIso);

    const startYear = startDate.getUTCFullYear();
    const finishYear = finishDate.getUTCFullYear();

    const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const rows: IMonthlyMatrixRow[] = [];

    // Идем от самых СВЕЖИХ годов к СТАРЫМ (например 2025, 2024, 2023)
    for (let yr = finishYear; yr >= startYear; yr--) {
      const cells: IMonthlyMatrixCell[] = [];
      const yearPortfolioReturns: number[] = [];
      const yearMcftrReturns: number[] = [];

      for (let m = 0; m < 12; m++) {
        // Начало и конец месяца
        const firstDayOfMonth = new Date(Date.UTC(yr, m, 1, 0, 0, 0));
        const lastDayOfMonth = new Date(Date.UTC(yr, m + 1, 0, 23, 0, 0));

        // Если месяц вне периода жизни портфеля — пустая ячейка
        if (lastDayOfMonth.getTime() < startDate.getTime() || firstDayOfMonth.getTime() > finishDate.getTime()) {
          cells.push({
            monthIndex: m,
            monthName: monthNames[m],
            portfolioReturn: null,
            mcftrReturn: null,
            alpha: null,
            isPartial: false,
            startDateDisplay: '',
            finishDateDisplay: '',
          });
          continue;
        }

        // Границы расчета для месяца
        const calcStart = firstDayOfMonth.getTime() < startDate.getTime() ? startDate : firstDayOfMonth;
        const calcFinish = lastDayOfMonth.getTime() > finishDate.getTime() ? finishDate : lastDayOfMonth;

        const isPartial = calcStart.getTime() !== firstDayOfMonth.getTime() || calcFinish.getTime() !== lastDayOfMonth.getTime();

        const calcStartIso = DateTimeStandardizer.toUTCISOString(calcStart);
        const calcFinishIso = DateTimeStandardizer.toUTCISOString(calcFinish);

        // Находим активные точки
        const calcStartTime = calcStart.getTime();
        let activeMs = milestonesAsc[0];
        for (const ms of milestonesAsc) {
          if (new Date(ms.date).getTime() <= calcStartTime) {
            activeMs = ms;
          } else {
            break;
          }
        }

        // Считаем профит портфеля за месяц
        let subWeightedProfit = 0;
        let subTotalWeight = 0;

        for (const asset of activeMs.assets) {
          const resolved = TickerResolver.resolveTicker(asset.ticker, calcStartIso);
          subTotalWeight += Number(asset.weight) || 0;

          const pStart = await MarketDataSyncService.getOrFetchPrice(resolved, calcStartIso);
          const pFinish = await MarketDataSyncService.getOrFetchPrice(resolved, calcFinishIso);

          const p1 = pStart?.price || 0;
          const p2 = pFinish?.price || 0;

          if (p1 > 0) {
            let divs = 0;
            if (asset.type === 'STOCK') {
              const allD = await MarketDataSyncService.getOrFetchDividends(resolved);
              const d1 = DateTimeStandardizer.toMSKDateString(calcStartIso);
              const d2 = DateTimeStandardizer.toMSKDateString(calcFinishIso);
              divs = allD.filter(d => d.date >= d1 && d.date <= d2).reduce((s, d) => s + Number(d.value), 0) * (1 - taxRate / 100);
            }
            const pPct = ((p2 + divs - p1) / p1) * 100;
            subWeightedProfit += pPct * (asset.weight / 100);
          }
        }

        const freeCashW = Math.max(0, Math.round((100 - subTotalWeight) * 100) / 100);
        if (freeCashW > 0) {
          const l1 = await MarketDataSyncService.getOrFetchPrice('LQDT', calcStartIso);
          const l2 = await MarketDataSyncService.getOrFetchPrice('LQDT', calcFinishIso);
          const lq1 = l1?.price || 0;
          const lq2 = l2?.price || 0;
          if (lq1 > 0) {
            const lqPct = ((lq2 - lq1) / lq1) * 100;
            subWeightedProfit += lqPct * (freeCashW / 100);
          }
        }

        // MCFTR за месяц
        const m1 = await MarketDataSyncService.getOrFetchMCFTR(calcStartIso);
        const m2 = await MarketDataSyncService.getOrFetchMCFTR(calcFinishIso);
        const mc1 = m1?.price || 0;
        const mc2 = m2?.price || 0;
        let subMcftrPct = 0;
        if (mc1 > 0) {
          subMcftrPct = ((mc2 - mc1) / mc1) * 100;
        }

        const mPortfolioRet = Number(subWeightedProfit.toFixed(2));
        const mMcftrRet = Number(subMcftrPct.toFixed(2));
        const mAlpha = Number((mPortfolioRet - mMcftrRet).toFixed(2));

        cells.push({
          monthIndex: m,
          monthName: monthNames[m],
          portfolioReturn: mPortfolioRet,
          mcftrReturn: mMcftrRet,
          alpha: mAlpha,
          isPartial,
          startDateDisplay: DateTimeStandardizer.formatToLocalDisplay(calcStartIso).split(' ')[0],
          finishDateDisplay: DateTimeStandardizer.formatToLocalDisplay(calcFinishIso).split(' ')[0],
        });

        yearPortfolioReturns.push(mPortfolioRet);
        yearMcftrReturns.push(mMcftrRet);
      }

      // Итого за календарный год
      const yrP = yearPortfolioReturns.length > 0 ? FinancialMath.calculateCompoundReturn(yearPortfolioReturns) : null;
      const yrM = yearMcftrReturns.length > 0 ? FinancialMath.calculateCompoundReturn(yearMcftrReturns) : null;
      const yrA = yrP !== null && yrM !== null ? yrP - yrM : null;

      rows.push({
        year: yr,
        months: cells,
        yearPortfolioReturn: yrP !== null ? Number(yrP.toFixed(2)) : null,
        yearMcftrReturn: yrM !== null ? Number(yrM.toFixed(2)) : null,
        yearAlpha: yrA !== null ? Number(yrA.toFixed(2)) : null,
      });
    }

    return rows;
  }
}