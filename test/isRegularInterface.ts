import type { RegularInterface } from "./test-generic";
import { isNumber, isString, isType } from "guardz";

export const isRegularInterface = isType<RegularInterface>({
  name: isString,
  value: isNumber,
});
