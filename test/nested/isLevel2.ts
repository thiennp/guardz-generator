import type { Level2 } from './../models/PrimitiveTypes';
import { isArrayWithEachItem, isType } from 'guardz';
import { isLevel3 } from './../models/isLevel3';

export const isLevel2 = isType<Level2>({
  mid: isLevel3,
  midArr: isArrayWithEachItem(isLevel3)
});
