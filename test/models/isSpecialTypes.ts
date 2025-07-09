import type { SpecialTypes } from './../dtos/EverythingDTO';
import { isNonEmptyString, isNonNegativeNumber, isPositiveNumber, isType } from 'guardz';
export const isSpecialTypes = isType<SpecialTypes>({
  nonEmptyStr: isNonEmptyString,
  nonNegNum: isNonNegativeNumber,
  posNum: isPositiveNumber
});
