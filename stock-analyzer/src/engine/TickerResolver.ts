import { ITickerRename } from '../types/domain';

/**
 * Полная официальная база переименований тикеров акций на Московской Бирже (MOEX)
 * за 2021–2025 гг.
 */
export const DEFAULT_TICKER_RENAMES: ITickerRename[] = [
  // Т-Банк / Т-Технологии (ранее ТКС Холдинг)
  {
    oldTicker: 'TCSG',
    newTicker: 'T',
    changeDate: '2024-11-28T00:00:00.000Z',
  },
  // Яндекс (МКПАО Яндекс)
  {
    oldTicker: 'YNDX',
    newTicker: 'YDEX',
    changeDate: '2024-07-24T00:00:00.000Z',
  },
  // Хэдхантер (МКПАО Хэдхантер)
  {
    oldTicker: 'HHRU',
    newTicker: 'HEAD',
    changeDate: '2024-09-26T00:00:00.000Z',
  },
  // X5 Group / Пятёрочка (МКПАО Корпоративный центр ИКС 5)
  {
    oldTicker: 'FIVE',
    newTicker: 'X5',
    changeDate: '2025-01-09T00:00:00.000Z',
  },
  // Софтлайн (ПАО Софтлайн, ранее Noventiq)
  {
    oldTicker: 'SFTL',
    newTicker: 'SOFL',
    changeDate: '2023-09-26T00:00:00.000Z',
  },
  // Артген биотех (ранее ИСКЧ)
  {
    oldTicker: 'ISKJ',
    newTicker: 'ABIO',
    changeDate: '2023-08-18T00:00:00.000Z',
  },
  // ВК (МКПАО ВК, ранее Mail.ru Group)
  {
    oldTicker: 'MAIL',
    newTicker: 'VKCO',
    changeDate: '2021-12-14T00:00:00.000Z',
  },
];

export class TickerResolver {
  /**
   * Возвращает корректный тикер для заданной даты с учетом карты переименований.
   * Учитывает как поиск "старый -> новый" (если дата после смены),
   * так и "новый -> старый" (если введен новый тикер, но дата до смены).
   */
  static resolveTicker(
    inputTicker: string,
    targetDateIso: string,
    customRenames: ITickerRename[] = []
  ): string {
    const cleanInput = inputTicker.trim().toUpperCase();
    if (!cleanInput) return '';

    const allRenames = [...DEFAULT_TICKER_RENAMES, ...customRenames];
    const targetTime = new Date(targetDateIso).getTime();

    for (const rule of allRenames) {
      const changeTime = new Date(rule.changeDate).getTime();

      // Если ввели старый тикер, но дата ПОСЛЕ смены тикера
      if (cleanInput === rule.oldTicker && targetTime >= changeTime) {
        return rule.newTicker;
      }
      // Если ввели новый тикер, но дата ДО смены тикера
      if (cleanInput === rule.newTicker && targetTime < changeTime) {
        return rule.oldTicker;
      }
    }

    return cleanInput;
  }
}