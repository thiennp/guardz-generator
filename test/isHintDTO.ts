import type { HintDTO } from "./test-types";
import { HintTypeEnum } from "./test-types";
import { isEnum, isNullOr, isString, isType } from "guardz";

export const isHintDTO = isType<HintDTO>({
  text: isString,
  helpText: isNullOr(isString),
  type: isEnum(HintTypeEnum),
});
