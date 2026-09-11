#!/usr/bin/env node
/**
 * Сборщик дивидендов для GitHub Actions.
 *
 * Запускается в CI (Node 22) ПОСЛЕ сборки: `npm run build && npm run fetch:dividends`.
 * Скачивает и парсит данные о дивидендах со Smart-Lab, Investmint и BCS
 * (на сервере GitHub нет CORS-ограничений и сетевых блокировок провайдера),
 * объединяет их и пишет статический JSON в dist/dividends/feed.json.
 *
 * PWA затем читает этот файл со своего же домена (GitHub Pages) — без прокси.
 */

import { parse } from 'node-html-parser';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const RU_MONTHS = {
  'янв': '01', 'января': '01', 'фев': '02', 'февраля': '02', 'мар': '03', 'марта': '03',
  'апр': '04', 'апреля': '04', 'май': '05', 'мая': '05', 'июн': '06', 'июня': '06',
  'июл': '07', 'июля': '07', 'авг': '08', 'августа': '08', 'сен': '09', 'сентября': '09',
  'окт': '10', 'октября': '10', 'ноя': '11', 'ноября': '11', 'дек': '12', 'декабря': '12',
};

async function fetchText(url, headers = {}) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      ...headers,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  return await resp.text();
}

/** Прямой запрос → allorigins → codetabs (на сервере CORS не мешает). */
async function fetchHtmlViaChain(url, name) {
  const attempts = [
    ['Прямой запрос', () => fetchText(url, { Referer: new URL(url).origin + '/' })],
    ['allorigins', async () => {
      const t = await fetchText(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      const j = JSON.parse(t);
      if (j && typeof j.contents === 'string' && j.contents.length > 0) return j.contents;
      throw new Error('нет поля contents');
    }],
    ['codetabs', () => fetchText(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`)],
  ];

  let lastErr = null;
  for (const [label, fn] of attempts) {
    try {
      const text = await fn();
      if (text && text.length > 500) {
        console.log(`  [${name}] OK через ${label} (${text.length} симв.)`);
        return text;
      }
      lastErr = new Error(`${label}: короткий/пустой ответ`);
      console.warn(`  [${name}] ${label}: короткий/пустой ответ`);
    } catch (e) {
      lastErr = e;
      console.warn(`  [${name}] ${label} FAIL: ${e.message}`);
    }
  }
  throw lastErr || new Error('нет доступных источников');
}

function parseValue(text = '') {
  const cleaned = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/₽/g, '')
    .replace(/руб\.?/gi, '')
    .replace(/%/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(cleaned)) return 0;
  const v = parseFloat(cleaned.replace(',', '.'));
  return Number.isFinite(v) && v > 0 && v < 50000 ? v : 0;
}

function parseDateDDMMYYYY(text = '') {
  const m = String(text || '').match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function parseRuDate(text = '') {
  const m = String(text || '').replace(/\u00a0/g, ' ').match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
  if (!m) return '';
  const month = RU_MONTHS[String(m[2]).toLowerCase()];
  if (!month) return '';
  return `${m[3]}-${month}-${String(Number(m[1])).padStart(2, '0')}`;
}

/** Smart-Lab: колонки Название(0) Тикер(1) ... Дивиденд(3) ... Дата закрытия реестра(7) ... */
export function parseSmartLab(html) {
  const root = parse(html);
  const out = [];
  for (const tr of root.querySelectorAll('table tr')) {
    const cells = tr.querySelectorAll('td');
    if (cells.length < 8) continue;

    let ticker = (cells[1]?.text || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{1,6}$/.test(ticker)) {
      for (const a of tr.querySelectorAll('a')) {
        const m = (a.getAttribute('href') || '').match(/\/(?:q|forum)\/([A-Z0-9]{1,6})\b/i);
        if (m) { ticker = m[1].toUpperCase(); break; }
      }
    }
    if (!/^[A-Z0-9]{1,6}$/.test(ticker)) continue;

    const date = parseDateDDMMYYYY(cells[7]?.text || '');
    const value = parseValue(cells[3]?.text || '');
    if (date && value) out.push({ ticker, date, value, source: 'smartlab' });
  }
  return out;
}

/** Investmint: колонки Акция(0) Реестр(1) Дивиденды(2) ... */
export function parseInvestmint(html) {
  const root = parse(html);
  const out = [];
  for (const tr of root.querySelectorAll('table tr')) {
    const cells = tr.querySelectorAll('td');
    if (cells.length < 3) continue;

    const tokens = (cells[0]?.text || '').match(/[A-Z]{1,6}/g);
    const ticker = tokens ? tokens[tokens.length - 1] : '';
    if (!/^[A-Z0-9]{1,6}$/.test(ticker)) continue;

    const date = parseRuDate(cells[1]?.text || '');
    const value = parseValue(cells[2]?.text || '');
    if (date && value) out.push({ ticker, date, value, source: 'investmint' });
  }
  return out;
}

/** BCS: публичный JSON-API календаря (actual=0 — прошедшие закрытия реестра). */
async function fetchBcs(year) {
  const url = `https://api.bcs.ru/divcalendar/v2/dividends?actual=0&limit=100&order=2&sorting=1&year=${year}`;
  const text = await fetchText(url, { Accept: 'application/json', Referer: 'https://bcs-express.ru/' });
  const json = JSON.parse(text);
  const out = [];
  for (const it of (json.data || [])) {
    const ticker = String(it.secureCode || '').toUpperCase();
    const date = parseDateDDMMYYYY(it.closingDate || '');
    const value = parseValue(String(it.dividendValue ?? ''));
    if (/^[A-Z0-9]{1,6}$/.test(ticker) && date && value) {
      out.push({ ticker, date, value, source: 'bcs' });
    }
  }
  return out;
}

async function main() {
  const outArgIdx = process.argv.indexOf('--out');
  const OUT = outArgIdx !== -1 ? process.argv[outArgIdx + 1] : 'dist/dividends/feed.json';
  if (!OUT) throw new Error('Укажите путь вывода: --out dist/dividends/feed.json');

  const now = new Date();
  const year = now.getUTCFullYear();
  const records = [];
  const errors = [];

  console.log(`Сбор дивидендов за ${year - 1}–${year}...`);

  // Smart-Lab: текущий + прошлый год
  for (const y of [year, year - 1]) {
    try {
      const html = await fetchHtmlViaChain(`https://smart-lab.ru/dividends/index?year=${y}`, `SmartLab ${y}`);
      const rows = parseSmartLab(html);
      records.push(...rows);
      console.log(`  [SmartLab ${y}] распознано: ${rows.length}`);
    } catch (e) {
      errors.push(`smartlab ${y}: ${e.message}`);
      console.warn(`  [SmartLab ${y}] ОШИБКА: ${e.message}`);
    }
  }

  // Investmint: прошедшие дивиденды
  try {
    const html = await fetchHtmlViaChain('https://investmint.ru/past-dividends/', 'Investmint');
    const rows = parseInvestmint(html);
    records.push(...rows);
    console.log(`  [Investmint] распознано: ${rows.length}`);
  } catch (e) {
    errors.push(`investmint: ${e.message}`);
    console.warn(`  [Investmint] ОШИБКА: ${e.message}`);
  }

  // BCS: JSON-API (текущий + прошлый год)
  for (const y of [year, year - 1]) {
    try {
      const rows = await fetchBcs(y);
      records.push(...rows);
      console.log(`  [BCS ${y}] распознано: ${rows.length}`);
    } catch (e) {
      errors.push(`bcs ${y}: ${e.message}`);
      console.warn(`  [BCS ${y}] ОШИБКА: ${e.message}`);
    }
  }

  // Дедупликация внутри каждого источника по тикер+дата
  const seen = new Set();
  const unique = [];
  for (const r of records) {
    const key = `${r.source}:${r.ticker}:${r.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }

  const feed = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    records: unique,
    errors,
  };

  const outPath = path.resolve(process.cwd(), OUT);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(feed), 'utf8');

  console.log(`\nИтог: ${unique.length} записей → ${outPath}`);
  if (errors.length) {
    console.warn('Ошибки источников (не критично, деплой продолжается):\n - ' + errors.join('\n - '));
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch(e => {
    console.error('Критическая ошибка:', e);
    process.exit(1);
  });
}
