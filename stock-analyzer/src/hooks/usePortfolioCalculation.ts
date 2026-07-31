import { useState, useEffect } from 'react';
import { IPortfolio } from '../types/domain';
import { PortfolioCalculationService, ICalculatedPortfolio } from '../services/engine/PortfolioCalculationService';

export function usePortfolioCalculation(portfolio: IPortfolio) {
  const [result, setResult] = useState<ICalculatedPortfolio | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    PortfolioCalculationService.calculatePortfolio(portfolio)
      .then(res => {
        if (isMounted) {
          setResult(res);
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
  }, [portfolio]);

  return { result, loading };
}