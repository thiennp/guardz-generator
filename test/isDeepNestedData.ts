import type { DeepNestedData } from './complex-test';
import { isBoolean, isDate, isNonEmptyArrayWithEachItem, isNonEmptyString, isNonNegativeNumber, isPositiveNumber, isType } from 'guardz';

export const isDeepNestedData = isType<DeepNestedData>({
  id: isNonEmptyString,
  value: isNonNegativeNumber,
  isActive: isBoolean,
  tags: isNonEmptyArrayWithEachItem(isNonEmptyString),
  metadata: isType({
    createdAt: isDate,
    updatedAt: isDate,
    version: isPositiveNumber
  }),
  settings: isType({
    enabled: isBoolean,
    timeout: isPositiveNumber,
    retries: isNonNegativeNumber
  })
});
