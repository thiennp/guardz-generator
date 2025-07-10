import type { Level3 } from "./test-types-comprehensive";
import { isArrayWithEachItem, isNumber, isString, isType } from "guardz";

export const isLevel3 = isType<Level3>({
  deep: isString,
  deepArr: isArrayWithEachItem(isNumber),
});
