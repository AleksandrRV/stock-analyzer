import { AssetType } from '../../types/domain';

export interface IMoexAsset {
  ticker: string;
  name: string;
  type: AssetType;
  aliases?: string[];
}
