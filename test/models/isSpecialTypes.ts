import type { SpecialTypes } from './PrimitiveTypes';
import { isNonEmptyString, isNonNegativeNumber, isPositiveNumber, isType } from 'guardz';

export const isSpecialTypes = isType<SpecialTypes>({
  nonEmptyStr: isNonEmptyString,
  nonNegNum: isNonNegativeNumber,
  posNum: isPositiveNumber
});
