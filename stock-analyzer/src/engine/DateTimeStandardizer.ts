export class DateTimeStandardizer {
  /**
   * Округляет локальную дату до часа (минуты, секунды и мс сбрасываются в 0)
   */
  static truncateToHour(date: Date): Date {
    const d = new Date(date);
    d.setMinutes(0, 0, 0);
    return d;
  }

  /**
   * Преобразует локальную дату в ISO UTC строку (для хранения в БД)
   */
  static toUTCISOString(localDate: Date): string {
    const truncated = this.truncateToHour(localDate);
    return truncated.toISOString();
  }

  /**
   * Преобразует ISO UTC строку в формат YYYY-MM-DD для API Мосбиржи (по МСК времени)
   */
  static toMSKDateString(utcIsoString: string): string {
    const d = new Date(utcIsoString);
    // Сдвиг к Московскому времени (UTC+3)
    const mskTime = new Date(d.getTime() + 3 * 60 * 60 * 1000);
    return mskTime.toISOString().split('T')[0];
  }

  /**
   * Преобразует ISO UTC строку в понятное пользователю локальное отображение (YYYY-MM-DD HH:00)
   */
  static formatToLocalDisplay(utcIsoString: string): string {
    const d = new Date(utcIsoString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:00`;
  }
}