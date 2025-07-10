import type { SpecialTypes } from './NestedTypes';
import { isNonEmptyString, isNonNegativeNumber, isPositiveNumber, isType } from 'guardz';

export const isSpecialTypes = isType<SpecialTypes>({
  nonEmptyStr: isNonEmptyString,
  nonNegNum: isNonNegativeNumber,
  posNum: isPositiveNumber
});
