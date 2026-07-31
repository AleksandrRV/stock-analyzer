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

  // Данные по MCFTR и Альфе на уровне ТОЧКИ
  mcftrStartPrice: number;
  mcftrFinishPrice: number;
  mcftrProfitPercent: number;
  mcftrAlphaPercent: number;
}

export interface ICalculatedPortfolio {
  portfolioId: string;
  startDateIso: string;
  finishDateIso: string;
  totalDays: number;
  calculatedMilestones: ICalculatedMilestone[];
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

      // А. Акции и фонды
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

      // Б. Кэш (LQDT)
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

      // В. Расчет MCFTR для ЭТОЙ конкретной точки
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

    const totalProfitPercent = FinancialMath.calculateCompoundReturn(milestoneReturns);
    const monthlyReturnPercent = FinancialMath.calculateMonthlyRate(totalProfitPercent, totalDays);
    const annualizedReturnPercent = FinancialMath.calculateAnnualizedRate(monthlyReturnPercent);

    // MCFTR весь портфель
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
}