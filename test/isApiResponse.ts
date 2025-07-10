import type { ApiResponse } from "./test-types";
import {
  isArrayWithEachItem,
  isBoolean,
  isString,
  isType,
  isUndefinedOr,
  isUnknown,
} from "guardz";

export const isApiResponse = isType<ApiResponse>({
  success: isBoolean,
  data: isUnknown,
  message: isUndefinedOr(isString),
  errors: isUndefinedOr(isArrayWithEachItem(isString)),
});
