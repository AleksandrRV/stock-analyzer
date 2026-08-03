import { useState, useEffect } from 'react';
import { IPortfolio } from '../types/domain';
import { PortfolioCalculationService, ICalculatedPortfolio } from '../services/engine/PortfolioCalculationService';
import { usePortfolioStore } from '../store/usePortfolioStore';

export function usePortfolioCalculation(portfolio: IPortfolio) {
  const { settings, calculationsCache, setCalculationCache } = usePortfolioStore();
  
  // Абсолютный час в истории (миллисекунды / 3,600,000) - гарантирует сброс на следующий день!
  const currentAbsoluteHour = Math.floor(Date.now() / 3600000);
  
  const cachedWrapper = calculationsCache[portfolio.id];
  const isCacheValid = cachedWrapper && cachedWrapper.calculatedAtHour === currentAbsoluteHour;
  
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
          setCalculationCache(portfolio.id, res, currentAbsoluteHour);
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
  }, [portfolio, settings, isCacheValid, currentAbsoluteHour, setCalculationCache]);

  return { result: cachedResult, loading };
}