import type { Level2 } from './EverythingDTO';
import { isArrayWithEachItem, isType } from 'guardz';
import { isLevel3 } from './isLevel3';

export const isLevel2 = isType<Level2>({
  mid: isLevel3,
  midArr: isArrayWithEachItem(isLevel3)
});
