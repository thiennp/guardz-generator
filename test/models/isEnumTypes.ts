import type { EnumTypes } from './PrimitiveTypes';
import { StatusEnum } from './PrimitiveTypes';
import { isBoolean, isEnum, isEqualTo, isNumber, isOneOf, isOneOfTypes, isString, isType } from 'guardz';

export const isEnumTypes = isType<EnumTypes>({
  status: isEnum(StatusEnum),
  oneOf: isOneOf('a', 'b', 'c'),
  oneOfTypes: isOneOfTypes<boolean | number | string>(isBoolean, isNumber, isString),
  equalTo42: isEqualTo(42)
});
