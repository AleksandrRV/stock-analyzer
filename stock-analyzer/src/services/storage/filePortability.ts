import { IExportData } from '../../types/domain';

export class FilePortabilityService {
  /**
   * Экспортирует данные приложения в файл JSON.
   * Использует File System Access API (на ПК) или Blob (на моб. устройствах).
   */
  static async exportData(data: IExportData, defaultFilename = 'moex_strategies_backup.json'): Promise<boolean> {
    const jsonString = JSON.stringify(data, null, 2);

    // 1. Прогрессивное улучшение: File System Access API (Chrome/Edge на ПК)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [
            {
              description: 'JSON Резервная копия стратегий (.json)',
              accept: { 'application/json': ['.json'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        return true;
      } catch (err: any) {
        if (err.name === 'AbortError') return false; // Пользователь отменил окно
        console.warn('File System Access API failed, falling back to Blob download:', err);
      }
    }

    // 2. Кроссплатформенный фоллбэк: Blob + <a download> (Android / iOS / Firefox)
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  /**
   * Проверяет и парсит структуру импортируемого JSON файла
   */
  static parseImportFile(jsonString: string): IExportData {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Файл не является валидным JSON файлом');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Некорректная структура файла');
    }

    if (!parsed.schemaVersion || parsed.schemaVersion !== 1) {
      throw new Error(`Неподдерживаемая версия схемы файла: ${parsed.schemaVersion || 'отсутствует'}`);
    }

    if (!Array.isArray(parsed.portfolios)) {
      throw new Error('Файл не содержит списка портфелей');
    }

    return parsed as IExportData;
  }
}