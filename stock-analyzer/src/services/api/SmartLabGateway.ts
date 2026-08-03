import { IDividendHistory } from '../../types/domain';

export class SmartLabGateway {
  static async fetchSmartLabDividends(year: number): Promise<IDividendHistory[]> {
    const url = `https://smart-lab.ru/dividends/index?year=${year}`;
    let htmlText = '';

    try {
      const resp = await fetch(url);
      if (resp.ok) {
        htmlText = await resp.text();
      }
    } catch {
      // Fallback to proxy
    }

    if (!htmlText) {
      try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const resp = await fetch(proxyUrl);
        if (resp.ok) {
          htmlText = await resp.text();
        }
      } catch {
        // Fallback to secondary proxy
      }
    }

    if (!htmlText) {
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const resp = await fetch(proxyUrl);
        if (resp.ok) {
          htmlText = await resp.text();
        }
      } catch {
        // Failed
      }
    }

    if (!htmlText) return [];

    return this.parseSmartLabHtml(htmlText);
  }

  private static parseSmartLabHtml(htmlText: string): IDividendHistory[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const results: IDividendHistory[] = [];

    const rows = doc.querySelectorAll('table tr');

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) return;

      let ticker = '';
      
      const anchors = row.querySelectorAll('a');
      anchors.forEach(a => {
        const href = a.getAttribute('href') || '';
        const match = href.match(/\/(?:q|forum)\/([A-Z0-9]{1,6})\b/i);
        if (match && !ticker) {
          ticker = match[1].toUpperCase();
        }
      });

      if (!ticker && cells[0]) {
        const text = cells[0].textContent?.trim().toUpperCase() || '';
        const match = text.match(/\b([A-Z]{1,5})\b/);
        if (match) {
          ticker = match[1];
        }
      }

      if (!ticker) return;

      let dateIso = '';
      const rowText = row.textContent || '';
      const dateMatch = rowText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        dateIso = `${year}-${month}-${day}`;
      } else {
        const dateMatchShort = rowText.match(/(\d{2})\.(\d{2})\.(\d{2})\b/);
        if (dateMatchShort) {
          const [, day, month, yearShort] = dateMatchShort;
          dateIso = `20${yearShort}-${month}-${day}`;
        }
      }

      if (!dateIso) return;

      let value = 0;
      cells.forEach(cell => {
        const cellText = cell.textContent?.trim() || '';
        const numMatch = cellText.match(/^(\d+(?:[.,]\d+)?)\s*(?:руб|₽)?$/i) || 
                         cellText.match(/(\d+(?:[.,]\d+)?)\s*(?:руб|₽)/i);
        if (numMatch && !value) {
          const parsedVal = parseFloat(numMatch[1].replace(',', '.'));
          if (parsedVal > 0 && parsedVal < 50000) {
            value = parsedVal;
          }
        }
      });

      if (ticker && dateIso && value > 0) {
        results.push({
          ticker,
          date: dateIso,
          value,
          isManual: true,
        });
      }
    });

    return results;
  }
}