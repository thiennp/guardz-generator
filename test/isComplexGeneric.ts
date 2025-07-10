import type { ComplexGeneric } from "./test-generic";
import type { TypeGuardFn } from "guardz";
import { isNumber, isString, isType, isUndefinedOr } from "guardz";

export const isComplexGeneric = <T,>(
  typeGuardT: TypeGuardFn<T>,
): TypeGuardFn<ComplexGeneric<T>> =>
  isType<ComplexGeneric<T>>({
    id: isNumber,
    data: typeGuardT,
    optional: isUndefinedOr(isString),
  });
