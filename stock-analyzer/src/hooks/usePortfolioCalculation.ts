import { useState, useEffect } from 'react';
import { IPortfolio } from '../types/domain';
import { PortfolioCalculationService, ICalculatedPortfolio } from '../services/engine/PortfolioCalculationService';
import { usePortfolioStore } from '../store/usePortfolioStore';

export function usePortfolioCalculation(portfolio: IPortfolio) {
  const { calculationsCache, setCalculationCache } = usePortfolioStore();
  
  // Если портфель уже был рассчитан и лежит в глобальном кэше — сразу отдаем его
  const cachedResult: ICalculatedPortfolio | null = calculationsCache[portfolio.id] || null;
  
  // Если кэша нет — показываем загрузку
  const [loading, setLoading] = useState<boolean>(!cachedResult);

  useEffect(() => {
    // Если результат уже есть в кэше — не делаем ничего
    if (calculationsCache[portfolio.id]) {
      return;
    }

    let isMounted = true;
    setLoading(true);

    PortfolioCalculationService.calculatePortfolio(portfolio)
      .then(res => {
        if (isMounted) {
          setCalculationCache(portfolio.id, res);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error(`Error calculating portfolio ${portfolio.id}:`, err);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [portfolio, calculationsCache, setCalculationCache]);

  return { 
    result: cachedResult, 
    loading 
  };
}