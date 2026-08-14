import { IMoexAsset } from './assetCatalogTypes';

export const MOEX_FUNDS: IMoexAsset[] = [
  { ticker: 'AKMM', name: 'Альфа-Капитал Денежный рынок', type: 'FUND', aliases: ['Альфа денежный рынок', 'Alfa Money Market'] },
  { ticker: 'EQMX', name: 'ВИМ Индекс Мосбиржи', type: 'FUND', aliases: ['ВТБ Индекс Мосбиржи', 'VIM Index'] },
  { ticker: 'LQDT', name: 'Фонд Ликвидности (ВИМ Ликвидность)', type: 'FUND', aliases: ['Ликвидность', 'Liquidity', 'Кэш'] },
  { ticker: 'SBMM', name: 'Сбер Фонд Денежный рынок', type: 'FUND', aliases: ['Сбер денежный рынок', 'Sber Money Market'] },
  { ticker: 'SBMX', name: 'Сбер Индекс Мосбиржи', type: 'FUND', aliases: ['Сбер индекс', 'Sber Index'] },
  { ticker: 'TMON', name: 'Т-Капитал Денежный рынок', type: 'FUND', aliases: ['Т денежный рынок', 'Tinkoff Money Market'] },
  { ticker: 'TMOS', name: 'Т-Капитал Индекс Мосбиржи', type: 'FUND', aliases: ['Т индекс Мосбиржи', 'Tinkoff Index'] },
];
