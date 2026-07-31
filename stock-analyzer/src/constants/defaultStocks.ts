import { AssetType } from '../types/domain';

export interface IPopularAsset {
  ticker: string;
  name: string;
  type: AssetType;
}

export const POPULAR_MOEX_ASSETS: IPopularAsset[] = [
  { ticker: 'SBER', name: 'Сбербанк', type: 'STOCK' },
  { ticker: 'LKOH', name: 'Лукойл', type: 'STOCK' },
  { ticker: 'YDEX', name: 'Яндекс', type: 'STOCK' },
  { ticker: 'T', name: 'Т-Банк (Т-Технологии)', type: 'STOCK' },
  { ticker: 'GAZP', name: 'Газпром', type: 'STOCK' },
  { ticker: 'ROSN', name: 'Роснефть', type: 'STOCK' },
  { ticker: 'NVTK', name: 'Новатэк', type: 'STOCK' },
  { ticker: 'GMKN', name: 'Норильский никель', type: 'STOCK' },
  { ticker: 'X5', name: 'X5 Group (Пятёрочка)', type: 'STOCK' },
  { ticker: 'MGNT', name: 'Магнит', type: 'STOCK' },
  { ticker: 'CHMF', name: 'Северсталь', type: 'STOCK' },
  { ticker: 'PLZL', name: 'Полюс Золото', type: 'STOCK' },
  { ticker: 'TATN', name: 'Татнефть', type: 'STOCK' },
  { ticker: 'MOEX', name: 'Московская Биржа', type: 'STOCK' },
  { ticker: 'LQDT', name: 'Фонд Ликвидности (БПИФ)', type: 'FUND' },
  { ticker: 'SBMM', name: 'Сбер - Фонд Денежный', type: 'FUND' },
];