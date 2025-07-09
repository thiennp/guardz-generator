import type { EverythingDTO } from './EverythingDTO';
import { isEnum, isType } from 'guardz';
import { isArrayTypes } from './isArrayTypes';
import { isEnumTypes } from './isEnumTypes';
import { isLevel1 } from './isLevel1';
import { isNullableTypes } from './isNullableTypes';
import { isObjectTypes } from './isObjectTypes';
import { isPrimitiveTypes } from './isPrimitiveTypes';
import { isSpecialTypes } from './isSpecialTypes';
export const isEverythingDTO = isType<EverythingDTO>({
  primitives: isPrimitiveTypes,
  nullable: isNullableTypes,
  arrays: isArrayTypes,
  objects: isObjectTypes,
  enums: isEnumTypes,
  specials: isSpecialTypes,
  nested: isLevel1
});
