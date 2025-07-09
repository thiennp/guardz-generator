import type { PrimitiveTypes } from './../dtos/EverythingDTO';
import { isAny, isBoolean, isDate, isNumber, isString, isType, isUnknown } from 'guardz';
export const isPrimitiveTypes = isType<PrimitiveTypes>({
  str: isString,
  num: isNumber,
  bool: isBoolean,
  anyVal: isAny,
  unknownVal: isUnknown,
  date: isDate
});
