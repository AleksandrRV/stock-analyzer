export class FinancialMath {
  /**
   * Вычисляет профит отдельной акции с учетом налога на дивиденды
   */
  static calculateStockProfit(
    priceStart: number,
    priceFinish: number,
    rawDividendsSum: number,
    taxRate: number = 15
  ): number {
    if (priceStart <= 0) return 0;
    const netDividends = rawDividendsSum * (1 - taxRate / 100);
    const totalValue = priceFinish + netDividends;
    return ((totalValue - priceStart) / priceStart) * 100;
  }

  /**
   * Находит сложный процент (накопленную геометрическую доходность) для цепи периодов
   * returns: массив доходностей в процентах (например [10, -5, 2])
   */
  static calculateCompoundReturn(returnsInPercent: number[]): number {
    if (returnsInPercent.length === 0) return 0;
    let multiplier = 1.0;
    for (const ret of returnsInPercent) {
      multiplier *= 1 + ret / 100;
    }
    return (multiplier - 1) * 100;
  }

  /**
   * Переводит доходность за N дней в среднемесячную (геометрическую)
   */
  static calculateMonthlyRate(totalReturnPercent: number, totalDays: number): number {
    if (totalDays <= 0) return 0;
    const months = totalDays / 30.4375; // Средняя длина месяца
    const multiplier = 1 + totalReturnPercent / 100;
    if (multiplier <= 0) return -100;
    const monthlyMultiplier = Math.pow(multiplier, 1 / months);
    return (monthlyMultiplier - 1) * 100;
  }

  /**
   * Переводит месячную доходность в СТРОГУЮ годовую по формуле сложного процента (1.01^12 = 12.68%)
   */
  static calculateAnnualizedRate(monthlyRatePercent: number): number {
    const monthlyMultiplier = 1 + monthlyRatePercent / 100;
    if (monthlyMultiplier <= 0) return -100;
    const annualMultiplier = Math.pow(monthlyMultiplier, 12);
    return (annualMultiplier - 1) * 100;
  }

  /**
   * Считает Альфу (превышение над индексом MCFTR)
   */
  static calculateAlpha(portfolioMonthlyReturn: number, indexMonthlyReturn: number): number {
    return portfolioMonthlyReturn - indexMonthlyReturn;
  }
}