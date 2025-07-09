import type { EverythingDTO } from './../models/PrimitiveTypes';
import { isType } from 'guardz';
import { isArrayTypes } from './../models/isArrayTypes';
import { isEnumTypes } from './../models/isEnumTypes';
import { isLevel1 } from './../models/isLevel1';
import { isNullableTypes } from './../models/isNullableTypes';
import { isObjectTypes } from './../models/isObjectTypes';
import { isPrimitiveTypes } from './../models/isPrimitiveTypes';
import { isSpecialTypes } from './../models/isSpecialTypes';

export const isEverythingDTO = isType<EverythingDTO>({
  primitives: isPrimitiveTypes,
  nullable: isNullableTypes,
  arrays: isArrayTypes,
  objects: isObjectTypes,
  enums: isEnumTypes,
  specials: isSpecialTypes,
  nested: isLevel1
});
