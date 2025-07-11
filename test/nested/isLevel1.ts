import type { Level1 } from './NestedTypes';
import { isArrayWithEachItem, isType, isUndefinedOr } from 'guardz';
import { isLevel2 } from './isLevel2';

export const isLevel1 = isType<Level1>({
  top: isLevel2,
  topArr: isArrayWithEachItem(isLevel2),
  optTop: isUndefinedOr(isLevel2)
});
