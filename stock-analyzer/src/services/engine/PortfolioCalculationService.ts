import { IPortfolio, AssetType, IGlobalSettings, IAssetAllocation } from '../../types/domain';
import { MarketDataSyncService } from '../sync/MarketDataSyncService';
import { FinancialMath } from '../../engine/FinancialMath';
import { DateTimeStandardizer } from '../../engine/DateTimeStandardizer';
import { TickerResolver } from '../../engine/TickerResolver';

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

interface ISubPeriodResult {
  assets: ICalculatedAsset[];
  freeCashWeight: number;
  lqdtStartPrice: number;
  lqdtFinishPrice: number;
  lqdtProfitPercent: number;
  mcftrStartPrice: number;
  mcftrFinishPrice: number;
  mcftrProfitPercent: number;
  portfolioProfitPercent: number;
}

export class PortfolioCalculationService {
  
  /**
   * Находит все даты завершения месяцев между start и end в 12:00:00 UTC
   */
  private static getMonthEndDatesBetween(startIso: string, endIso: string): string[] {
    const result: string[] = [];
    const start = new Date(startIso);
    const end = new Date(endIso);

    let current = DateTimeStandardizer.getUTCMonthEndNoShift(start.getUTCFullYear(), start.getUTCMonth());

    while (current.getTime() < end.getTime()) {
      if (current.getTime() > start.getTime()) {
        result.push(current.toISOString());
      }
      current = DateTimeStandardizer.getUTCMonthEndNoShift(current.getUTCFullYear(), current.getUTCMonth() + 1);
    }
    return result;
  }

  /**
   * ЯДРО: Изолированный расчёт одного суб-интервала с ПАРАЛЛЕЛЬНОЙ загрузкой данных
   */
  private static async _calculateSubPeriodReturns(
    assets: IAssetAllocation[],
    startIso: string,
    finishIso: string,
    settings: IGlobalSettings
  ): Promise<ISubPeriodResult> {
    const taxRate = settings.dividendTaxRate ?? 15;
    const customRenames = settings.tickerRenames || [];
    const customSplits = settings.stockSplits || [];

    const calculatedAssets: ICalculatedAsset[] = [];
    let totalAllocatedWeight = 0;
    let portfolioProfitPercent = 0;

    // ПАРАЛЛЕЛЬНАЯ ОБРАБОТКА ВСЕХ АКТИВОВ ТОЧКИ
    const assetPromises = assets.map(async (asset) => {
      const currentTicker = TickerResolver.resolveTickerToCurrent(asset.ticker, customRenames);
      const startResolved = TickerResolver.resolveTicker(asset.ticker, startIso, customRenames);
      const finishResolved = TickerResolver.resolveTicker(asset.ticker, finishIso, customRenames);
      
      const pStartRes = MarketDataSyncService.getOrFetchPrice(startResolved, startIso);
      const pFinishRes = MarketDataSyncService.getOrFetchPrice(finishResolved, finishIso);
      
      // Запускаем запросы цен параллельно
      const [pStart, pFinish] = await Promise.all([pStartRes, pFinishRes]);

      const startPriceRaw = pStart?.price || 0;
      const finishPriceRaw = pFinish?.price || 0;

      const p1Coef = TickerResolver.getPriceAdjustmentToToday(startResolved, startIso, customRenames, customSplits);
      const p2Coef = TickerResolver.getPriceAdjustmentToToday(finishResolved, finishIso, customRenames, customSplits);

      const startPrice = startPriceRaw > 0 ? startPriceRaw / p1Coef : 0;
      const finishPrice = finishPriceRaw > 0 ? finishPriceRaw / p2Coef : 0;

      let rawDividends = 0;
      let netDividends = 0;

      if (asset.type === 'STOCK' && startPrice > 0) {
        const divsStartRes = MarketDataSyncService.getOrFetchDividends(startResolved);
        const divsFinishRes = startResolved !== finishResolved 
          ? MarketDataSyncService.getOrFetchDividends(finishResolved) 
          : Promise.resolve([]);
        
        const [divsStart, divsFinish] = await Promise.all([divsStartRes, divsFinishRes]);
        const allD = [...divsStart, ...divsFinish];
        const uniqueD = Array.from(new Map(allD.map(d => [d.date, d])).values());

        const d1 = DateTimeStandardizer.toMSKDateString(startIso);
        const d2 = DateTimeStandardizer.toMSKDateString(finishIso);
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

      return {
        ticker: asset.ticker,
        resolvedTicker: startResolved === finishResolved ? startResolved : `${startResolved} → ${finishResolved}`,
        weight: asset.weight,
        type: asset.type,
        startPrice: Number(startPrice.toFixed(2)),
        finishPrice: Number(finishPrice.toFixed(2)),
        rawDividends: Number(rawDividends.toFixed(2)),
        netDividends: Number(netDividends.toFixed(2)),
        profitPercent: Number(profitPercent.toFixed(2)),
      };
    });

    const resolvedAssets = await Promise.all(assetPromises);

    for (const ca of resolvedAssets) {
      calculatedAssets.push(ca);
      totalAllocatedWeight += Number(ca.weight) || 0;
      portfolioProfitPercent += ca.profitPercent * (ca.weight / 100);
    }

    // РАСЧЕТ LQDT И MCFTR ПАРАЛЛЕЛЬНО
    const freeCashWeight = Math.max(0, Math.round((100 - totalAllocatedWeight) * 100) / 100);
    let lqdtStartPrice = 0;
    let lqdtFinishPrice = 0;
    let lqdtProfitPercent = 0;

    let mcftrStartPrice = 0;
    let mcftrFinishPrice = 0;
    let mcftrProfitPercent = 0;

    const basePromises = [];
    basePromises.push(MarketDataSyncService.getOrFetchMCFTR(startIso));
    basePromises.push(MarketDataSyncService.getOrFetchMCFTR(finishIso));

    if (freeCashWeight > 0) {
      basePromises.push(MarketDataSyncService.getOrFetchPrice('LQDT', startIso));
      basePromises.push(MarketDataSyncService.getOrFetchPrice('LQDT', finishIso));
    }

    const baseResults = await Promise.all(basePromises);
    
    mcftrStartPrice = baseResults[0]?.price || 0;
    mcftrFinishPrice = baseResults[1]?.price || 0;
    if (mcftrStartPrice > 0) {
      mcftrProfitPercent = ((mcftrFinishPrice - mcftrStartPrice) / mcftrStartPrice) * 100;
    }

    if (freeCashWeight > 0) {
      lqdtStartPrice = baseResults[2]?.price || 0;
      lqdtFinishPrice = baseResults[3]?.price || 0;
      if (lqdtStartPrice > 0) {
        lqdtProfitPercent = ((lqdtFinishPrice - lqdtStartPrice) / lqdtStartPrice) * 100;
        portfolioProfitPercent += lqdtProfitPercent * (freeCashWeight / 100);
      }
    }

    return {
      assets: calculatedAssets,
      freeCashWeight,
      lqdtStartPrice,
      lqdtFinishPrice,
      lqdtProfitPercent,
      mcftrStartPrice,
      mcftrFinishPrice,
      mcftrProfitPercent,
      portfolioProfitPercent
    };
  }

  static async calculateChartCurveForRange(
    portfolio: IPortfolio,
    rangeStartIso: string,
    rangeFinishIso: string,
    settings: IGlobalSettings
  ): Promise<IEquityChartPoint[]> {
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
        if (new Date(ms.date).getTime() <= subStartTime) activeMs = ms;
        else break;
      }

      const res = await this._calculateSubPeriodReturns(activeMs.assets, subStartIso, subFinishIso, settings);

      cumPortfolioMult *= (1 + res.portfolioProfitPercent / 100);
      cumMcftrMult *= (1 + res.mcftrProfitPercent / 100);

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

  static async calculatePortfolio(portfolio: IPortfolio, settings: IGlobalSettings): Promise<ICalculatedPortfolio> {
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
      const msFinishIso = (i + 1 < milestonesAsc.length) ? milestonesAsc[i + 1].date : finishDateIso;

      const durationHours = Math.max(1, Math.round((new Date(msFinishIso).getTime() - new Date(msStartIso).getTime()) / (1000 * 60 * 60)));
      const durationDays = Math.round(durationHours / 24);

      const res = await this._calculateSubPeriodReturns(currentMs.assets, msStartIso, msFinishIso, settings);

      calculatedMilestones.push({
        milestoneId: currentMs.id,
        startDateIso: msStartIso,
        finishDateIso: msFinishIso,
        durationHours,
        durationDays,
        assets: res.assets,
        freeCashWeight: res.freeCashWeight,
        lqdtStartPrice: res.lqdtStartPrice,
        lqdtFinishPrice: res.lqdtFinishPrice,
        lqdtProfitPercent: res.lqdtProfitPercent,
        totalProfitPercent: res.portfolioProfitPercent,
        mcftrStartPrice: res.mcftrStartPrice,
        mcftrFinishPrice: res.mcftrFinishPrice,
        mcftrProfitPercent: res.mcftrProfitPercent,
        mcftrAlphaPercent: res.portfolioProfitPercent - res.mcftrProfitPercent,
      });

      milestoneReturns.push(res.portfolioProfitPercent);
    }

    const chartPoints = await this.calculateChartCurveForRange(portfolio, startDateIso, finishDateIso, settings);

    const totalProfitPercent = FinancialMath.calculateCompoundReturn(milestoneReturns);
    const monthlyReturnPercent = FinancialMath.calculateMonthlyRate(totalProfitPercent, totalDays);
    const annualizedReturnPercent = FinancialMath.calculateAnnualizedRate(monthlyReturnPercent);

    const mcftrStart = await MarketDataSyncService.getOrFetchMCFTR(startDateIso);
    const mcftrFinish = await MarketDataSyncService.getOrFetchMCFTR(finishDateIso);
    
    let mcftrMonthlyReturnPercent = 0;
    let mcftrTotalProfitPercent = 0;
    
    if (mcftrStart?.price && mcftrFinish?.price && mcftrStart.price > 0) {
      mcftrTotalProfitPercent = ((mcftrFinish.price - mcftrStart.price) / mcftrStart.price) * 100;
      mcftrMonthlyReturnPercent = FinancialMath.calculateMonthlyRate(mcftrTotalProfitPercent, totalDays);
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
      mcftrTotalProfitPercent,
      mcftrMonthlyReturnPercent,
      alphaMonthlyPercent,
      performanceColor,
      isLoading: false,
      error: null,
    };
  }

  static async calculateMonthlyReturnsMatrix(portfolio: IPortfolio, settings: IGlobalSettings): Promise<IMonthlyMatrixRow[]> {
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
        // Концы месяцев строим через полдень UTC
        const firstDayOfMonth = DateTimeStandardizer.getUTCMonthEndNoShift(yr, m - 1);
        const lastDayOfMonth = DateTimeStandardizer.getUTCMonthEndNoShift(yr, m);

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

        const calcStartTime = calcStart.getTime();
        let activeMs = milestonesAsc[0];
        for (const ms of milestonesAsc) {
          if (new Date(ms.date).getTime() <= calcStartTime) activeMs = ms;
          else break;
        }

        const res = await this._calculateSubPeriodReturns(activeMs.assets, calcStartIso, calcFinishIso, settings);

        const mPortfolioRet = Number(res.portfolioProfitPercent.toFixed(2));
        const mMcftrRet = Number(res.mcftrProfitPercent.toFixed(2));
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