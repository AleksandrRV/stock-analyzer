import { useEffect, useMemo, useRef, useState } from 'react';
import { IAssetAllocation, IGlobalSettings } from '../types/domain';
import { MarketDataSyncService } from '../services/sync/MarketDataSyncService';
import { MilestoneAssetVerifier, IAssetCheckResult } from '../services/market/MilestoneAssetVerifier';

const VERIFY_DEBOUNCE_MS = 350;

export interface IMcftrQuote {
  value: number | null;
  tradeDate: string | null;
  isLoading: boolean;
}

export interface IMilestoneMarketData {
  checks: Record<string, IAssetCheckResult>;
  mcftr: IMcftrQuote;
  isVerifying: boolean;
  invalidTickers: string[];
  unverifiedTickers: string[];
}

export function useMilestoneMarketData(
  assets: IAssetAllocation[],
  targetUtcIso: string,
  settings: IGlobalSettings,
  isActive: boolean
): IMilestoneMarketData {
  const [checks, setChecks] = useState<Record<string, IAssetCheckResult>>({});
  const [mcftr, setMcftr] = useState<IMcftrQuote>({ value: null, tradeDate: null, isLoading: false });

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const verifyRunRef = useRef(0);
  const mcftrRunRef = useRef(0);

  const dateKey = useMemo(() => MilestoneAssetVerifier.buildDateKey(targetUtcIso), [targetUtcIso]);
  const assetsKey = useMemo(() => assets.map(a => `${a.ticker}:${a.type}`).join('|'), [assets]);

  useEffect(() => {
    if (!isActive || !targetUtcIso) return;

    const queue = assets.map(a => ({ ticker: a.ticker.trim().toUpperCase(), type: a.type }));
    const runId = ++verifyRunRef.current;

    setChecks(prev => {
      const next: Record<string, IAssetCheckResult> = {};
      for (const item of queue) {
        const known = prev[item.ticker];
        next[item.ticker] = known && known.dateKey === dateKey
          ? known
          : MilestoneAssetVerifier.createPendingResult(item.ticker, targetUtcIso);
      }
      return next;
    });

    if (queue.length === 0) return;

    const timer = setTimeout(() => {
      for (const item of queue) {
        MilestoneAssetVerifier
          .verifyAsset(item.ticker, item.type, targetUtcIso, settingsRef.current)
          .then(result => {
            if (verifyRunRef.current !== runId) return;
            setChecks(prev => (prev[item.ticker] ? { ...prev, [item.ticker]: result } : prev));
          });
      }
    }, VERIFY_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [assetsKey, dateKey, isActive, targetUtcIso]);

  useEffect(() => {
    if (!isActive || !targetUtcIso) return;

    const runId = ++mcftrRunRef.current;
    setMcftr(prev => ({ ...prev, isLoading: true }));

    const timer = setTimeout(() => {
      MarketDataSyncService.getOrFetchMCFTR(targetUtcIso).then(result => {
        if (mcftrRunRef.current !== runId) return;
        setMcftr({
          value: result ? result.price : null,
          tradeDate: result ? result.actualTradeDate : null,
          isLoading: false,
        });
      });
    }, VERIFY_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [dateKey, isActive, targetUtcIso]);

  const currentResults = useMemo(
    () => assets.map(a => checks[a.ticker.trim().toUpperCase()]).filter((r): r is IAssetCheckResult => !!r),
    [assets, checks]
  );

  const isVerifying = currentResults.some(r => r.status === 'PENDING')
    || currentResults.length !== assets.length;

  const invalidTickers = currentResults
    .filter(r => r.status === 'UNKNOWN_TICKER' || r.status === 'NO_PRICE_ON_DATE')
    .map(r => r.ticker);

  const unverifiedTickers = currentResults
    .filter(r => r.status === 'UNVERIFIED')
    .map(r => r.ticker);

  return { checks, mcftr, isVerifying, invalidTickers, unverifiedTickers };
}
