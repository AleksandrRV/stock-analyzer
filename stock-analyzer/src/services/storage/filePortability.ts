import { IExportData } from '../../types/domain';

export class FilePortabilityService {
  static async exportData(data: IExportData, defaultFilename = 'moex_strategies_backup.json'): Promise<boolean> {
    const jsonString = JSON.stringify(data, null, 2);

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
        if (err.name === 'AbortError') return false; 
        console.warn('File System Access API failed, falling back to Blob download:', err);
      }
    }

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
   * Проверяет и парсит структуру импортируемого JSON файла со строгой валидацией
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

    // Жесткая валидация структуры портфелей и весов активов
    for (const port of parsed.portfolios) {
      if (!port.id || !port.name) {
        throw new Error('Один из портфелей не содержит ID или Имени');
      }
      if (Array.isArray(port.milestones)) {
        for (const ms of port.milestones) {
          if (!ms.id || !ms.date) throw new Error(`Контрольная точка портфеля ${port.name} повреждена`);
          
          if (Array.isArray(ms.assets)) {
            let totalWeight = 0;
            for (const asset of ms.assets) {
              if (!asset.ticker || typeof asset.weight !== 'number') {
                throw new Error(`Актив в портфеле ${port.name} поврежден`);
              }
              totalWeight += asset.weight;
            }
            // Защита от измененных вручную файлов с перевесом
            if (totalWeight > 100.001) {
              throw new Error(`Сумма долей активов в портфеле "${port.name}" превышает 100% (${totalWeight}%)`);
            }
          }
        }
      }
    }

    return parsed as IExportData;
  }
}