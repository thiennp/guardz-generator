import type { NullableTypes } from './../models/PrimitiveTypes';
import { isBoolean, isDate, isNullOr, isNumber, isString, isType, isUndefinedOr } from 'guardz';

export const isNullableTypes = isType<NullableTypes>({
  maybeStr: isNullOr(isString),
  maybeNum: isNullOr(isNumber),
  maybeBool: isNullOr(isBoolean),
  maybeDate: isNullOr(isDate),
  optStr: isUndefinedOr(isString),
  optNum: isUndefinedOr(isNumber),
  optBool: isUndefinedOr(isBoolean),
  optDate: isUndefinedOr(isDate),
  undefOrStr: isUndefinedOr(isString),
  undefOrNum: isUndefinedOr(isNumber)
});
