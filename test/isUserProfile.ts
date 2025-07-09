import type { UserProfile } from './complex-test';
import { isBoolean, isNonEmptyArrayWithEachItem, isNonEmptyString, isNullOr, isOneOf, isPositiveNumber, isString, isType, isUndefinedOr } from 'guardz';
import { isDeepNestedData } from './isDeepNestedData';

export const isUserProfile = isType<UserProfile>({
  userId: isNonEmptyString,
  username: isNonEmptyString,
  email: isString,
  age: isPositiveNumber,
  preferences: isType({
    theme: isOneOf('light', 'dark', 'auto'),
    language: isOneOf('en', 'es', 'fr'),
    notifications: isBoolean
  }),
  deepData: isDeepNestedData,
  deepDataArray: isNonEmptyArrayWithEachItem(isDeepNestedData),
  optionalDeepData: isUndefinedOr(isDeepNestedData),
  nullableDeepData: isNullOr(isDeepNestedData)
});
