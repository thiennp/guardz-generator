import type { ObjectTypes } from './../dtos/EverythingDTO';
import { isBoolean, isNumber, isObjectWithEachItem, isPartialOf, isString, isType } from 'guardz';

export const isObjectTypes = isType<ObjectTypes>({
  obj: isObjectWithEachItem(isNumber),
  nonNullObj: isType({
    foo: isString
  }),
  partialObj: isPartialOf({
    a: isString,
    b: isNumber
  }),
  objWithEach: isObjectWithEachItem(isBoolean)
});
