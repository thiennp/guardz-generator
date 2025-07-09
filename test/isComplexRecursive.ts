import type { ComplexRecursive } from './recursive-test';
import { isArrayWithEachItem, isDate, isString, isType, isUndefinedOr } from 'guardz';

export function isComplexRecursive(value: unknown): value is ComplexRecursive {
  return isType<ComplexRecursive>({
    name: isString,
    metadata: isType({
    created: isDate,
    updated: isDate
  }),
    children: isArrayWithEachItem(isComplexRecursive),
    parent: isUndefinedOr(isComplexRecursive)
  })(value);
}
