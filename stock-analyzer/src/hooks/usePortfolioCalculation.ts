import { useState, useEffect } from 'react';
import { IPortfolio } from '../types/domain';
import { PortfolioCalculationService, ICalculatedPortfolio } from '../services/engine/PortfolioCalculationService';
import { usePortfolioStore } from '../store/usePortfolioStore';

export function usePortfolioCalculation(portfolio: IPortfolio) {
  const { settings, calculationsCache, setCalculationCache } = usePortfolioStore();
  
  const currentHour = new Date().getHours(); // Текущий локальный час
  const cachedWrapper = calculationsCache[portfolio.id];

  // Проверяем валидность кэша: есть ли он, и совпадает ли час расчета с текущим
  const isCacheValid = cachedWrapper && cachedWrapper.calculatedAtHour === currentHour;
  
  const cachedResult: ICalculatedPortfolio | null = isCacheValid ? cachedWrapper.result : null;
  const [loading, setLoading] = useState<boolean>(!isCacheValid);

  useEffect(() => {
    if (isCacheValid) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    PortfolioCalculationService.calculatePortfolio(portfolio, settings)
      .then(res => {
        if (isMounted) {
          setCalculationCache(portfolio.id, res, currentHour);
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
  }, [portfolio, settings, isCacheValid, currentHour, setCalculationCache]);

  return { 
    result: cachedResult, 
    loading 
  };
}