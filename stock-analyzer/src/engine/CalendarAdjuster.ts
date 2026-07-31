export class CalendarAdjuster {
  /**
   * Возвращает начальную дату для отрезка поиска (сдвигает на 7 дней назад),
   * чтобы гарантированно захватить последнюю торговую сессию, если выбран выходной.
   */
  static getFromDateForSearch(mskDateString: string): string {
    const d = new Date(mskDateString);
    d.setDate(d.getDate() - 7); // Берём с запасом неделю назад
    return d.toISOString().split('T')[0];
  }
}