import type { SpecialTypes } from "./test-types-comprehensive";
import {
  isNonEmptyString,
  isNonNegativeNumber,
  isPositiveNumber,
  isType,
} from "guardz";

export const isSpecialTypes = isType<SpecialTypes>({
  nonEmptyStr: isNonEmptyString,
  nonNegNum: isNonNegativeNumber,
  posNum: isPositiveNumber,
});
