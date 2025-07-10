import type { OptionalRecursive } from "./recursive-test";
import { isNumber, isType, isUndefinedOr } from "guardz";

export function isOptionalRecursive(
  value: unknown,
): value is OptionalRecursive {
  return isType<OptionalRecursive>({
    id: isNumber,
    parent: isUndefinedOr(isOptionalRecursive),
  })(value);
}
