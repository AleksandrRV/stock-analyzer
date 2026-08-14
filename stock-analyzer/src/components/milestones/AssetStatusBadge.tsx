import React from 'react';
import { IAssetCheckResult } from '../../services/market/MilestoneAssetVerifier';
import { NumberFormatter } from '../../engine/NumberFormatter';
import { AlertTriangle, CheckCircle2, Loader2, WifiOff, XCircle } from 'lucide-react';

interface Props {
  check?: IAssetCheckResult;
}

export const AssetStatusBadge: React.FC<Props> = ({ check }) => {
  if (!check || check.status === 'PENDING') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-slate-400">
        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
        <span>Проверка цены...</span>
      </span>
    );
  }

  if (check.status === 'OK') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
        <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
          {NumberFormatter.formatMoney(check.price || 0)} ₽
        </span>
        {check.tradeDate && <span>на {NumberFormatter.formatMskDate(check.tradeDate)}</span>}
      </span>
    );
  }

  if (check.status === 'UNKNOWN_TICKER') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-rose-500 font-medium">
        <XCircle className="w-3 h-3 shrink-0" />
        <span>Тикер не найден на Мосбирже</span>
      </span>
    );
  }

  if (check.status === 'NO_PRICE_ON_DATE') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-amber-500 font-medium">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>Нет торгов на выбранную дату</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-[11px] text-slate-400">
      <WifiOff className="w-3 h-3 shrink-0" />
      <span>Цена недоступна офлайн</span>
    </span>
  );
};
