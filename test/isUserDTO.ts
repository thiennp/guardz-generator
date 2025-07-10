import type { UserDTO } from "./test-types";
import {
  isArrayWithEachItem,
  isBoolean,
  isDate,
  isNumber,
  isObjectWithEachItem,
  isString,
  isType,
  isUndefinedOr,
  isUnknown,
} from "guardz";

export const isUserDTO = isType<UserDTO>({
  id: isNumber,
  name: isString,
  email: isString,
  isActive: isBoolean,
  createdAt: isDate,
  tags: isArrayWithEachItem(isString),
  metadata: isUndefinedOr(isObjectWithEachItem(isUnknown)),
});
