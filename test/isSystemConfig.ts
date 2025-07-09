import type { SystemConfig } from './complex-test';
import type { ComplexUser } from './complex-test';
import type { DeepNestedData } from './complex-test';
import type { NonEmptyArray } from 'guardz';
import type { NonEmptyString } from 'guardz';
import type { PositiveNumber } from 'guardz';
import { TestStatus } from './complex-test';
import { Priority } from './complex-test';
import { isAny, isBoolean, isDate, isEnum, isEqualTo, isNonEmptyArrayWithEachItem, isNonEmptyString, isNonNegativeNumber, isObjectWithEachItem, isOneOf, isOneOfTypes, isPartialOf, isPositiveNumber, isType, isUnknown } from 'guardz';
import { isComplexUser } from './isComplexUser';
import { isDeepNestedData } from './isDeepNestedData';

export const isSystemConfig = isType<SystemConfig>({
  systemId: isNonEmptyString,
  version: isNonEmptyString,
  users: isNonEmptyArrayWithEachItem(isComplexUser),
  activeUsers: isNonEmptyArrayWithEachItem(isComplexUser),
  inactiveUsers: isNonEmptyArrayWithEachItem(isComplexUser),
  settings: isType({
    maxUsers: isPositiveNumber,
    timeout: isNonNegativeNumber,
    features: isType({
      advanced: isBoolean,
      premium: isBoolean,
      beta: isBoolean
    }),
    limits: isType({
      storage: isPositiveNumber,
      bandwidth: isNonNegativeNumber,
      requests: isPositiveNumber
    })
  }),
  status: isEnum(TestStatus),
  priority: isEnum(Priority),
  metadata: isType({
    deployed: isDate,
    lastUpdate: isDate,
    version: isNonEmptyString
  }),
  deepConfig: isType({
    nested: isType({
      very: isType({
        deep: isType({
          value: isNonEmptyString,
          count: isPositiveNumber,
          enabled: isBoolean
        })
      })
    })
  }),
  partialConfig: isPartialOf({
    optionalField: isNonEmptyString,
    optionalNumber: isPositiveNumber,
    optionalBoolean: isBoolean
  }),
  recordConfig: isObjectWithEachItem(isNonEmptyString),
  arrayConfig: isNonEmptyArrayWithEachItem(isType({
    key: isNonEmptyString,
    value: isNonEmptyString,
    count: isPositiveNumber
  })),
  unionConfig: isOneOfTypes<boolean | NonEmptyArray<PositiveNumber> | NonEmptyString>(isBoolean, isNonEmptyArrayWithEachItem(isPositiveNumber), isNonEmptyString),
  complexUnion: isOneOfTypes<ComplexUser | DeepNestedData>(isComplexUser, isDeepNestedData),
  anyConfig: isAny,
  unknownConfig: isUnknown,
  literalUnion: isOneOf('option1', 'option2', 'option3'),
  numberUnion: isOneOf(1, 2, 3, 4, 5),
  booleanUnion: isOneOfTypes<false | true>(isEqualTo(false), isEqualTo(true)),
  nullUnion: isOneOfTypes<NonEmptyString | null>(isNonEmptyString, isEqualTo(null)),
  undefinedUnion: isOneOfTypes<PositiveNumber | undefined>(isPositiveNumber, isEqualTo(undefined))
});
