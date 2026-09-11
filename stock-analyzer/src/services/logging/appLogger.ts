export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface ILogEntry {
  id: string;
  timestamp: string; // ISO UTC
  level: LogLevel;
  source: string;
  message: string;
  details?: string;
}

const STORAGE_KEY = 'app_logs';
const MAX_LOGS = 300;

function load(): ILogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ILogEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: ILogEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_LOGS)));
  } catch {
    // Переполнение localStorage — просто не сохраняем
  }
}

function consoleMirror(level: LogLevel, source: string, message: string, details?: string) {
  const fn =
    level === 'error' ? console.error
      : level === 'warn' ? console.warn
        : level === 'success' ? console.info
          : console.log;
  if (details) fn(`[${source}] ${message}`, details);
  else fn(`[${source}] ${message}`);
}

/**
 * Лёгкий журнал событий приложения: хранится в localStorage
 * (последние MAX_LOGS записей) и дублируется в консоль.
 */
export const appLogger = {
  log(level: LogLevel, source: string, message: string, details?: string): ILogEntry {
    const entry: ILogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      details,
    };
    persist([entry, ...load()]);
    consoleMirror(level, source, message, details);
    return entry;
  },

  info(source: string, message: string, details?: string) {
    return this.log('info', source, message, details);
  },
  success(source: string, message: string, details?: string) {
    return this.log('success', source, message, details);
  },
  warn(source: string, message: string, details?: string) {
    return this.log('warn', source, message, details);
  },
  error(source: string, message: string, details?: string) {
    return this.log('error', source, message, details);
  },

  getLogs(): ILogEntry[] {
    return load();
  },

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};
