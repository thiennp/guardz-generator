import type { Level2 } from './dtos/EverythingDTO';
import { isArrayWithEachItem, isType } from 'guardz';
import { isLevel3 } from './dtos/isLevel3';

export const isLevel2 = isType<Level2>({
  mid: isLevel3,
  midArr: isArrayWithEachItem(isLevel3)
});
