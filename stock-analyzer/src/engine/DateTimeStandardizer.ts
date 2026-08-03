export class DateTimeStandardizer {
  static truncateToHour(date: Date): Date {
    const d = new Date(date);
    d.setMinutes(0, 0, 0);
    return d;
  }

  static toUTCISOString(localDate: Date): string {
    const truncated = this.truncateToHour(localDate);
    return truncated.toISOString();
  }

  static toMSKDateString(utcIsoString: string): string {
    const d = new Date(utcIsoString);
    const mskTime = new Date(d.getTime() + 3 * 60 * 60 * 1000);
    return mskTime.toISOString().split('T')[0];
  }

  static formatToLocalDisplay(utcIsoString: string): string {
    const d = new Date(utcIsoString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:00`;
  }

  static getUTCMonthEndNoShift(year: number, monthIndex: number): Date {
    return new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0));
  }

  /**
   * Возвращает строку для <input type="datetime-local"> 
   * строго в локальном часовом поясе устройства (с округлением до часов).
   */
  static getLocalDatetimeLocalString(dateOverride?: string): string {
    const d = dateOverride ? new Date(dateOverride) : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:00`;
  }
}