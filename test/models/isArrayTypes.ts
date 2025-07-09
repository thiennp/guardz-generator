import type { ArrayTypes } from './PrimitiveTypes';
import { isArrayWithEachItem, isNullOr, isNumber, isString, isType } from 'guardz';

export const isArrayTypes = isType<ArrayTypes>({
  arr: isArrayWithEachItem(isString),
  arrOfArr: isArrayWithEachItem(isArrayWithEachItem(isNumber)),
  arrOfNullable: isArrayWithEachItem(isNullOr(isString))
});
