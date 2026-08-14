export class NumberFormatter {
  static formatMoney(value: number): string {
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  static formatIndex(value: number): string {
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  static formatMskDate(mskDateString: string): string {
    const parts = mskDateString.split('-');
    if (parts.length !== 3) return mskDateString;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
}
