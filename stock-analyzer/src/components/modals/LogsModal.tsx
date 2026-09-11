import React, { useState, useEffect } from 'react';
import { appLogger, ILogEntry, LogLevel } from '../../services/logging/appLogger';
import { FileText, RefreshCw, Trash2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const LEVEL_STYLES: Record<LogLevel, { badge: string; dot: string }> = {
  error: {
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    dot: 'bg-rose-500',
  },
  warn: {
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    dot: 'bg-amber-500',
  },
  success: {
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  info: {
    badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
    dot: 'bg-sky-500',
  },
};

const LEVEL_LABEL: Record<LogLevel, string> = {
  error: 'Ошибка',
  warn: 'Предупреждение',
  success: 'Успех',
  info: 'Инфо',
};

function formatLocalTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

export const LogsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<ILogEntry[]>([]);

  const reload = () => setLogs(appLogger.getLogs());

  useEffect(() => {
    if (isOpen) reload();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClear = () => {
    if (window.confirm('Очистить все логи?')) {
      appLogger.clear();
      reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-500/10 text-slate-600 dark:text-slate-300 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Журнал событий (логи)</h3>
              <p className="text-xs text-slate-400">
                Последние записи о запросах к бирже и Smart-Lab ({logs.length})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto pr-1 min-h-[200px]">
          {logs.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400 border border-dashed rounded-xl">
              Логов пока нет. Они появятся после запросов к бирже или Smart-Lab.
            </div>
          ) : (
            logs.map(entry => {
              const style = LEVEL_STYLES[entry.level];
              return (
                <div
                  key={entry.id}
                  className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                    <span className={`px-1.5 py-0.5 rounded font-semibold border ${style.badge}`}>
                      {LEVEL_LABEL[entry.level]}
                    </span>
                    <span className="font-mono text-slate-500">{entry.source}</span>
                    <span className="ml-auto font-mono text-[10px] text-slate-400">
                      {formatLocalTime(entry.timestamp)}
                    </span>
                  </div>
                  <div className="mt-1.5 font-medium text-slate-700 dark:text-slate-200 break-words">
                    {entry.message}
                  </div>
                  {entry.details && (
                    <div className="mt-1.5 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg font-mono text-[10px] text-slate-500 dark:text-slate-400 whitespace-pre-wrap break-all leading-relaxed">
                      {entry.details}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
          <div className="flex gap-2">
            <button
              onClick={reload}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Обновить</span>
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white text-xs font-medium rounded-lg transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Очистить</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            Назад
          </button>
        </div>
      </div>
    </div>
  );
};
