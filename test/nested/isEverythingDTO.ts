import type { EverythingDTO } from './../dtos/EverythingDTO';
import { isType } from 'guardz';
import { isArrayTypes } from './../dtos/isArrayTypes';
import { isEnumTypes } from './../dtos/isEnumTypes';
import { isLevel1 } from './../dtos/isLevel1';
import { isNullableTypes } from './../dtos/isNullableTypes';
import { isObjectTypes } from './../dtos/isObjectTypes';
import { isPrimitiveTypes } from './../dtos/isPrimitiveTypes';
import { isSpecialTypes } from './../dtos/isSpecialTypes';
export const isEverythingDTO = isType<EverythingDTO>({
  primitives: isPrimitiveTypes,
  nullable: isNullableTypes,
  arrays: isArrayTypes,
  objects: isObjectTypes,
  enums: isEnumTypes,
  specials: isSpecialTypes,
  nested: isLevel1
});
