import { IPortfolio, AssetType } from '../../types/domain';
import { MarketDataSyncService } from '../sync/MarketDataSyncService';
import { FinancialMath } from '../../engine/FinancialMath';
import { DateTimeStandardizer } from '../../engine/DateTimeStandardizer';
import { TickerResolver } from '../../engine/TickerResolver';
import { UserStorage } from '../storage/userStorage';

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
  timestamp: number;
  type: 'START' | 'MILESTONE' | 'MONTH_END' | 'FINISH';
  portfolioReturn: number;
  mcftrReturn: number;
  alpha: number;
}

export interface IMonthlyMatrixCell {
  monthIndex: number;
  monthName: string;
  portfolioReturn: number | null;
  mcftrReturn: number | null;
  alpha: number | null;
  isPartial: boolean;
  startDateDisplay: string;
  finishDateDisplay: string;
}

export interface IMonthlyMatrixRow {
  year: number;
  months: IMonthlyMatrixCell[];
  yearPortfolioReturn: number | null;
  yearMcftrReturn: number | null;
  yearAlpha: number | null;
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
    const savedTax = UserStorage.getSettings().dividendTaxRate;
    const taxRate = savedTax !== undefined && savedTax !== null ? savedTax : 15;
    const customRenames = UserStorage.getSettings().tickerRenames || [];
    const customSplits = UserStorage.getSettings().stockSplits || [];

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
        const currentTicker = TickerResolver.resolveTickerToCurrent(asset.ticker, customRenames);
        const startResolved = TickerResolver.resolveTicker(asset.ticker, subStartIso, customRenames);
        const finishResolved = TickerResolver.resolveTicker(asset.ticker, subFinishIso, customRenames);
        
        subTotalWeight += Number(asset.weight) || 0;

        const pStart = await MarketDataSyncService.getOrFetchPrice(startResolved, subStartIso);
        const pFinish = await MarketDataSyncService.getOrFetchPrice(finishResolved, subFinishIso);

        const p1Raw = pStart?.price || 0;
        const p2Raw = pFinish?.price || 0;

        const p1Coef = TickerResolver.getPriceAdjustmentToToday(startResolved, subStartIso, customRenames, customSplits);
        const p2Coef = TickerResolver.getPriceAdjustmentToToday(finishResolved, subFinishIso, customRenames, customSplits);

        const p1 = p1Raw > 0 ? p1Raw / p1Coef : 0;
        const p2 = p2Raw > 0 ? p2Raw / p2Coef : 0;

        if (p1 > 0) {
          let divs = 0;
          if (asset.type === 'STOCK') {
            const divsStart = await MarketDataSyncService.getOrFetchDividends(startResolved);
            const divsFinish = startResolved !== finishResolved ? await MarketDataSyncService.getOrFetchDividends(finishResolved) : [];
            const allD = [...divsStart, ...divsFinish];
            const uniqueD = Array.from(new Map(allD.map(d => [d.date, d])).values());

            const d1 = DateTimeStandardizer.toMSKDateString(subStartIso);
            const d2 = DateTimeStandardizer.toMSKDateString(subFinishIso);
            const periodDivs = uniqueD.filter(d => d.date > d1 && d.date <= d2);
            
            for (const d of periodDivs) {
              const divCoef = TickerResolver.getDividendAdjustmentToToday(currentTicker, new Date(d.date).toISOString(), customSplits);
              divs += (Number(d.value) / divCoef);
            }
            divs = divs * (1 - taxRate / 100);
          }
          const pPct = ((p2 + divs - p1) / p1) * 100;
          subWeightedProfit += pPct * (asset.weight / 100);
        }
      }

      const freeCashW = Math.max(0, Math.round((100 - subTotalWeight) * 100) / 100);
      if (freeCashW > 0) {
        const l1 = await MarketDataSyncService.getOrFetchPrice('LQDT', subStartIso);
        const l2 = await MarketDataSyncService.getOrFetchPrice('LQDT', subFinishIso);
        if (l1?.price && l2?.price && l1.price > 0) {
          subWeightedProfit += (((l2.price - l1.price) / l1.price) * 100) * (freeCashW / 100);
        }
      }

      const m1 = await MarketDataSyncService.getOrFetchMCFTR(subStartIso);
      const m2 = await MarketDataSyncService.getOrFetchMCFTR(subFinishIso);
      if (m1?.price && m2?.price && m1.price > 0) {
        const subMcftrPct = ((m2.price - m1.price) / m1.price) * 100;
        cumMcftrMult *= (1 + subMcftrPct / 100);
      }

      cumPortfolioMult *= (1 + subWeightedProfit / 100);
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
    const savedTax = UserStorage.getSettings().dividendTaxRate;
    const taxRate = savedTax !== undefined && savedTax !== null ? savedTax : 15;
    const customRenames = UserStorage.getSettings().tickerRenames || [];
    const customSplits = UserStorage.getSettings().stockSplits || [];

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

      const calculatedAssets: ICalculatedAsset[] = [];
      let totalAllocatedWeight = 0;
      let msWeightedProfitSum = 0;

      for (const asset of currentMs.assets) {
        const currentTicker = TickerResolver.resolveTickerToCurrent(asset.ticker, customRenames);
        const startResolved = TickerResolver.resolveTicker(asset.ticker, msStartIso, customRenames);
        const finishResolved = TickerResolver.resolveTicker(asset.ticker, msFinishIso, customRenames);
        
        totalAllocatedWeight += Number(asset.weight) || 0;

        const startRes = await MarketDataSyncService.getOrFetchPrice(startResolved, msStartIso);
        const finishRes = await MarketDataSyncService.getOrFetchPrice(finishResolved, msFinishIso);

        const startPriceRaw = startRes?.price || 0;
        const finishPriceRaw = finishRes?.price || 0;

        const p1Coef = TickerResolver.getPriceAdjustmentToToday(startResolved, msStartIso, customRenames, customSplits);
        const p2Coef = TickerResolver.getPriceAdjustmentToToday(finishResolved, msFinishIso, customRenames, customSplits);

        const startPrice = startPriceRaw > 0 ? startPriceRaw / p1Coef : 0;
        const finishPrice = finishPriceRaw > 0 ? finishPriceRaw / p2Coef : 0;

        let rawDividends = 0;
        let netDividends = 0;

        if (asset.type === 'STOCK') {
          const divsStart = await MarketDataSyncService.getOrFetchDividends(startResolved);
          const divsFinish = startResolved !== finishResolved ? await MarketDataSyncService.getOrFetchDividends(finishResolved) : [];
          const allD = [...divsStart, ...divsFinish];
          const uniqueD = Array.from(new Map(allD.map(d => [d.date, d])).values());

          const d1 = DateTimeStandardizer.toMSKDateString(msStartIso);
          const d2 = DateTimeStandardizer.toMSKDateString(msFinishIso);
          const periodDivs = uniqueD.filter(d => d.date > d1 && d.date <= d2);
          
          for (const d of periodDivs) {
            const divCoef = TickerResolver.getDividendAdjustmentToToday(currentTicker, new Date(d.date).toISOString(), customSplits);
            rawDividends += (Number(d.value) / divCoef);
          }
          netDividends = rawDividends * (1 - taxRate / 100);
        }

        const profitPercent = startPrice > 0 
          ? FinancialMath.calculateStockProfit(startPrice, finishPrice, rawDividends, taxRate)
          : 0;

        calculatedAssets.push({
          ticker: asset.ticker,
          resolvedTicker: startResolved === finishResolved ? startResolved : `${startResolved} → ${finishResolved}`,
          weight: asset.weight,
          type: asset.type,
          startPrice: Number(startPrice.toFixed(2)),
          finishPrice: Number(finishPrice.toFixed(2)),
          rawDividends: Number(rawDividends.toFixed(2)),
          netDividends: Number(netDividends.toFixed(2)),
          profitPercent: Number(profitPercent.toFixed(2)),
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
          msWeightedProfitSum += lqdtProfitPercent * (freeCashWeight / 100);
        }
      }

      const m1 = await MarketDataSyncService.getOrFetchMCFTR(msStartIso);
      const m2 = await MarketDataSyncService.getOrFetchMCFTR(msFinishIso);
      const mcftrStartPrice = m1?.price || 0;
      const mcftrFinishPrice = m2?.price || 0;
      let mcftrProfitPercent = 0;
      if (mcftrStartPrice > 0) {
        mcftrProfitPercent = ((mcftrFinishPrice - mcftrStartPrice) / mcftrStartPrice) * 100;
      }

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
        mcftrAlphaPercent: msWeightedProfitSum - mcftrProfitPercent,
      });

      milestoneReturns.push(msWeightedProfitSum);
    }

    const chartPoints = await this.calculateChartCurveForRange(portfolio, startDateIso, finishDateIso);

    const totalProfitPercent = FinancialMath.calculateCompoundReturn(milestoneReturns);
    const monthlyReturnPercent = FinancialMath.calculateMonthlyRate(totalProfitPercent, totalDays);
    const annualizedReturnPercent = FinancialMath.calculateAnnualizedRate(monthlyReturnPercent);

    const mcftrStart = await MarketDataSyncService.getOrFetchMCFTR(startDateIso);
    const mcftrFinish = await MarketDataSyncService.getOrFetchMCFTR(finishDateIso);
    let mcftrMonthlyReturnPercent = 0;
    if (mcftrStart?.price && mcftrFinish?.price && mcftrStart.price > 0) {
      const mcftrTotal = ((mcftrFinish.price - mcftrStart.price) / mcftrStart.price) * 100;
      mcftrMonthlyReturnPercent = FinancialMath.calculateMonthlyRate(mcftrTotal, totalDays);
    }

    const alphaMonthlyPercent = FinancialMath.calculateAlpha(monthlyReturnPercent, mcftrMonthlyReturnPercent);

    let performanceColor: 'RED' | 'YELLOW' | 'GREEN' = 'RED';
    if (alphaMonthlyPercent > 0.9) performanceColor = 'GREEN';
    else if (alphaMonthlyPercent >= 0.01) performanceColor = 'YELLOW';

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
      mcftrStartPrice: mcftrStart?.price || 0,
      mcftrFinishPrice: mcftrFinish?.price || 0,
      mcftrTotalProfitPercent: 0,
      mcftrMonthlyReturnPercent,
      alphaMonthlyPercent,
      performanceColor,
      isLoading: false,
      error: null,
    };
  }

  static async calculateMonthlyReturnsMatrix(portfolio: IPortfolio): Promise<IMonthlyMatrixRow[]> {
    const savedTax = UserStorage.getSettings().dividendTaxRate;
    const taxRate = savedTax !== undefined && savedTax !== null ? savedTax : 15;
    const customRenames = UserStorage.getSettings().tickerRenames || [];
    const customSplits = UserStorage.getSettings().stockSplits || [];

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

    for (let yr = finishYear; yr >= startYear; yr--) {
      const cells: IMonthlyMatrixCell[] = [];
      const yearPortfolioReturns: number[] = [];
      const yearMcftrReturns: number[] = [];

      for (let m = 0; m < 12; m++) {
        const firstDayOfMonth = new Date(Date.UTC(yr, m, 1, 0, 0, 0));
        const lastDayOfMonth = new Date(Date.UTC(yr, m + 1, 0, 23, 0, 0));

        if (lastDayOfMonth.getTime() < startDate.getTime() || firstDayOfMonth.getTime() > finishDate.getTime()) {
          cells.push({
            monthIndex: m, monthName: monthNames[m], portfolioReturn: null, mcftrReturn: null,
            alpha: null, isPartial: false, startDateDisplay: '', finishDateDisplay: '',
          });
          continue;
        }

        const calcStart = firstDayOfMonth.getTime() < startDate.getTime() ? startDate : firstDayOfMonth;
        const calcFinish = lastDayOfMonth.getTime() > finishDate.getTime() ? finishDate : lastDayOfMonth;
        const isPartial = calcStart.getTime() !== firstDayOfMonth.getTime() || calcFinish.getTime() !== lastDayOfMonth.getTime();
        const calcStartIso = DateTimeStandardizer.toUTCISOString(calcStart);
        const calcFinishIso = DateTimeStandardizer.toUTCISOString(calcFinish);

        let activeMs = milestonesAsc[0];
        for (const ms of milestonesAsc) {
          if (new Date(ms.date).getTime() <= calcStart.getTime()) activeMs = ms;
          else break;
        }

        let subWeightedProfit = 0;
        let subTotalWeight = 0;

        for (const asset of activeMs.assets) {
          const currentTicker = TickerResolver.resolveTickerToCurrent(asset.ticker, customRenames);
          const startResolved = TickerResolver.resolveTicker(asset.ticker, calcStartIso, customRenames);
          const finishResolved = TickerResolver.resolveTicker(asset.ticker, calcFinishIso, customRenames);
          
          subTotalWeight += Number(asset.weight) || 0;

          const pStart = await MarketDataSyncService.getOrFetchPrice(startResolved, calcStartIso);
          const pFinish = await MarketDataSyncService.getOrFetchPrice(finishResolved, calcFinishIso);

          const p1Coef = TickerResolver.getPriceAdjustmentToToday(startResolved, calcStartIso, customRenames, customSplits);
          const p2Coef = TickerResolver.getPriceAdjustmentToToday(finishResolved, calcFinishIso, customRenames, customSplits);

          const p1 = pStart?.price ? pStart.price / p1Coef : 0;
          const p2 = pFinish?.price ? pFinish.price / p2Coef : 0;

          if (p1 > 0) {
            let divs = 0;
            if (asset.type === 'STOCK') {
              const divsStart = await MarketDataSyncService.getOrFetchDividends(startResolved);
              const divsFinish = startResolved !== finishResolved ? await MarketDataSyncService.getOrFetchDividends(finishResolved) : [];
              const allD = [...divsStart, ...divsFinish];
              const uniqueD = Array.from(new Map(allD.map(d => [d.date, d])).values());

              const d1 = DateTimeStandardizer.toMSKDateString(calcStartIso);
              const d2 = DateTimeStandardizer.toMSKDateString(calcFinishIso);
              const periodDivs = uniqueD.filter(d => d.date > d1 && d.date <= d2);
              
              for (const d of periodDivs) {
                const divCoef = TickerResolver.getDividendAdjustmentToToday(currentTicker, new Date(d.date).toISOString(), customSplits);
                divs += (Number(d.value) / divCoef);
              }
              divs = divs * (1 - taxRate / 100);
            }
            const pPct = ((p2 + divs - p1) / p1) * 100;
            subWeightedProfit += pPct * (asset.weight / 100);
          }
        }

        const freeCashW = Math.max(0, Math.round((100 - subTotalWeight) * 100) / 100);
        if (freeCashW > 0) {
          const l1 = await MarketDataSyncService.getOrFetchPrice('LQDT', calcStartIso);
          const l2 = await MarketDataSyncService.getOrFetchPrice('LQDT', calcFinishIso);
          if (l1?.price && l2?.price && l1.price > 0) {
            subWeightedProfit += (((l2.price - l1.price) / l1.price) * 100) * (freeCashW / 100);
          }
        }

        const m1 = await MarketDataSyncService.getOrFetchMCFTR(calcStartIso);
        const m2 = await MarketDataSyncService.getOrFetchMCFTR(calcFinishIso);
        let subMcftrPct = 0;
        if (m1?.price && m2?.price && m1.price > 0) {
          subMcftrPct = ((m2.price - m1.price) / m1.price) * 100;
        }

        const mPortfolioRet = Number(subWeightedProfit.toFixed(2));
        const mMcftrRet = Number(subMcftrPct.toFixed(2));
        const mAlpha = Number((mPortfolioRet - mMcftrRet).toFixed(2));

        cells.push({
          monthIndex: m, monthName: monthNames[m], portfolioReturn: mPortfolioRet, mcftrReturn: mMcftrRet,
          alpha: mAlpha, isPartial,
          startDateDisplay: DateTimeStandardizer.formatToLocalDisplay(calcStartIso).split(' ')[0],
          finishDateDisplay: DateTimeStandardizer.formatToLocalDisplay(calcFinishIso).split(' ')[0],
        });
        yearPortfolioReturns.push(mPortfolioRet);
        yearMcftrReturns.push(mMcftrRet);
      }

      const yrP = yearPortfolioReturns.length > 0 ? FinancialMath.calculateCompoundReturn(yearPortfolioReturns) : null;
      const yrM = yearMcftrReturns.length > 0 ? FinancialMath.calculateCompoundReturn(yearMcftrReturns) : null;
      const yrA = yrP !== null && yrM !== null ? yrP - yrM : null;

      rows.push({
        year: yr, months: cells,
        yearPortfolioReturn: yrP !== null ? Number(yrP.toFixed(2)) : null,
        yearMcftrReturn: yrM !== null ? Number(yrM.toFixed(2)) : null,
        yearAlpha: yrA !== null ? Number(yrA.toFixed(2)) : null,
      });
    }

    return rows;
  }

  private static getEmptyResult(portfolioId: string): ICalculatedPortfolio {
    return {
      portfolioId, startDateIso: '', finishDateIso: '', totalDays: 0, calculatedMilestones: [],
      chartPoints: [], totalProfitPercent: 0, monthlyReturnPercent: 0, annualizedReturnPercent: 0,
      mcftrStartPrice: 0, mcftrFinishPrice: 0, mcftrTotalProfitPercent: 0, mcftrMonthlyReturnPercent: 0,
      alphaMonthlyPercent: 0, performanceColor: 'RED', isLoading: false, error: null,
    };
  }
}