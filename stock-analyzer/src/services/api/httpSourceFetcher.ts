import { appLogger } from '../logging/appLogger';

const DEFAULT_TIMEOUT_MS = 15000;

interface IHttpAttempt {
  label: string;
  url: string;
  unwrap?: (resp: Response) => Promise<string>;
}

export interface IFetchViaSourcesOptions {
  /** Свой CORS-прокси (префикс вида https://cors.eu.org/ или шаблон с {url}). */
  customProxyUrl?: string;
  /** Проверка, что полученный текст действительно нужные данные. */
  validate?: (text: string) => boolean;
  /** Дополнительные заголовки (Accept, Referer и т.д.). */
  headers?: Record<string, string>;
  /** Имя источника для логов. */
  sourceName?: string;
  timeoutMs?: number;
}

/**
 * Собирает URL своего прокси. Поддерживаются два формата:
 *  - префикс:        https://cors.eu.org/            → https://cors.eu.org/<target>
 *  - шаблон {url}:   https://host/proxy?url={url}    → {url} заменяется на закодированный адрес
 */
export function buildProxyUrl(base: string, target: string): string {
  const trimmed = base.trim();
  if (!trimmed) return '';
  if (trimmed.includes('{url}')) {
    return trimmed.replace('{url}', encodeURIComponent(target));
  }
  return `${trimmed.replace(/\/+$/, '')}/${target}`;
}

/**
 * Собирает «браузерные» заголовки. Замечание: в браузере заголовки
 * User-Agent / Referer / Origin являются запрещёнными (forbidden) и будут
 * проигнорированы движком fetch — реальный браузерный User-Agent уходит
 * автоматически и пробрасывается прокси, которые пересылают клиентские
 * заголовки (например, cors.eu.org). Явно задаём их на случай выполнения
 * в средах, где это разрешено (своя прокси/бэкенд).
 */
function buildBrowserHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': extra?.Accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
  };
  try {
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
  } catch { /* ignore */ }
  if (extra?.Referer) {
    try { headers['Referer'] = extra.Referer; } catch { /* ignore */ }
  }
  for (const [k, v] of Object.entries(extra || {})) {
    if (k === 'Accept' || k === 'Referer') continue;
    headers[k] = v;
  }
  return headers;
}

async function unwrapAllOriginsGet(resp: Response): Promise<string> {
  const json = await resp.json();
  if (json && typeof json.contents === 'string' && json.contents.length > 0) {
    return json.contents;
  }
  throw new Error('В ответе allorigins отсутствует поле contents');
}

function buildAttempts(targetUrl: string, opts: IFetchViaSourcesOptions): IHttpAttempt[] {
  const enc = encodeURIComponent(targetUrl);
  const attempts: IHttpAttempt[] = [];

  const custom = opts.customProxyUrl ? buildProxyUrl(opts.customProxyUrl, targetUrl) : '';
  if (custom) {
    attempts.push({ label: 'Свой прокси', url: custom });
  }

  attempts.push({ label: 'Прямой запрос', url: targetUrl });
  attempts.push({ label: 'cors.eu.org', url: `https://cors.eu.org/${targetUrl}` });
  attempts.push({
    label: 'allorigins /get',
    url: `https://api.allorigins.win/get?url=${enc}`,
    unwrap: unwrapAllOriginsGet,
  });
  attempts.push({ label: 'allorigins /raw', url: `https://api.allorigins.win/raw?url=${enc}` });
  attempts.push({ label: 'codetabs proxy', url: `https://api.codetabs.com/v1/proxy?quest=${enc}` });

  return attempts;
}

interface IAttemptOutcome { ok: boolean; text?: string; }

/**
 * Загружает URL по цепочке источников (свой прокси → прямой → публичные прокси)
 * ПАРАЛЛЕЛЬНО: побеждает первый, вернувший валидные данные. Каждая попытка
 * подробно логируется через appLogger.
 */
export async function fetchViaSources(
  targetUrl: string,
  opts: IFetchViaSourcesOptions,
): Promise<{ text: string; sourceLabel: string }> {
  const attempts = buildAttempts(targetUrl, opts);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = buildBrowserHeaders(opts.headers);
  const sourceName = opts.sourceName || 'Source';
  const validate = opts.validate;
  const failures: string[] = [];

  const runAttempt = async (attempt: IHttpAttempt): Promise<IAttemptOutcome> => {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(attempt.url, { signal: controller.signal, cache: 'no-cache', headers });
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startedAt;

      if (!resp.ok) {
        const errMsg = `HTTP ${resp.status} ${resp.statusText}`;
        appLogger.warn(sourceName, `${attempt.label}: ошибка запроса — ${errMsg} (${durationMs} мс)`, attempt.url);
        failures.push(`${attempt.label}: ${errMsg}`);
        return { ok: false };
      }

      const text = attempt.unwrap ? await attempt.unwrap(resp) : await resp.text();

      if (validate && !validate(text)) {
        appLogger.warn(sourceName, `${attempt.label}: ответ не прошёл проверку (${text.length} симв.)`, attempt.url);
        failures.push(`${attempt.label}: ответ не похож на ожидаемые данные`);
        return { ok: false };
      }

      appLogger.success(sourceName, `Данные получены через «${attempt.label}» (${text.length} симв., ${durationMs} мс)`, attempt.url);
      return { ok: true, text };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startedAt;
      const reason = err?.name === 'AbortError'
        ? `таймаут запроса (${timeoutMs / 1000} c)`
        : (err?.message || String(err));
      appLogger.warn(sourceName, `${attempt.label}: запрос не выполнен — ${reason} (${durationMs} мс)`, attempt.url);
      failures.push(`${attempt.label}: ${reason}`);
      return { ok: false };
    }
  };

  return await new Promise<{ text: string; sourceLabel: string }>((resolve, reject) => {
    if (attempts.length === 0) {
      reject(new Error('Нет доступных источников (не задан прокси и нет прямого доступа)'));
      return;
    }
    let settled = false;
    let remaining = attempts.length;

    attempts.forEach(attempt => {
      runAttempt(attempt)
        .then(outcome => {
          if (settled) return;
          if (outcome.ok && outcome.text !== undefined) {
            settled = true;
            resolve({ text: outcome.text, sourceLabel: attempt.label });
          } else {
            remaining -= 1;
            if (remaining === 0) {
              settled = true;
              reject(new Error(failures.join(' | ') || 'Все источники не ответили'));
            }
          }
        })
        .catch(() => {
          if (settled) return;
          remaining -= 1;
          if (remaining === 0) {
            settled = true;
            reject(new Error(failures.join(' | ') || 'Все источники не ответили'));
          }
        });
    });
  });
}
