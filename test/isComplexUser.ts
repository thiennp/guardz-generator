import type { ComplexUser } from "./complex-test";
import { TestStatus } from "./complex-test";
import { Priority } from "./complex-test";
import {
  isAny,
  isBoolean,
  isDate,
  isEnum,
  isEqualTo,
  isNonEmptyArrayWithEachItem,
  isNonEmptyString,
  isNonNegativeNumber,
  isNullOr,
  isOneOf,
  isPositiveNumber,
  isType,
  isUndefinedOr,
  isUnknown,
} from "guardz";
import { isUserProfile } from "./isUserProfile";

export const isComplexUser = isType<ComplexUser>({
  id: isNonEmptyString,
  name: isNonEmptyString,
  profile: isUserProfile,
  profiles: isNonEmptyArrayWithEachItem(isUserProfile),
  status: isEnum(TestStatus),
  priority: isEnum(Priority),
  scores: isNonEmptyArrayWithEachItem(isPositiveNumber),
  metadata: isType({
    created: isDate,
    lastLogin: isDate,
    loginCount: isNonNegativeNumber,
    isVerified: isBoolean,
  }),
  settings: isType({
    notifications: isType({
      email: isBoolean,
      push: isBoolean,
      sms: isBoolean,
    }),
    privacy: isType({
      publicProfile: isBoolean,
      showEmail: isBoolean,
      allowMessages: isBoolean,
    }),
  }),
  optionalProfile: isUndefinedOr(isUserProfile),
  nullableProfile: isNullOr(isUserProfile),
  anyData: isAny,
  unknownData: isUnknown,
  literalValue: isOneOf("specific", "exact", "value"),
  numberLiteral: isEqualTo(42),
  booleanLiteral: isEqualTo(true),
  stringLiteral: isEqualTo("hello"),
  nullValue: isEqualTo(null),
  undefinedValue: isEqualTo(undefined),
});
