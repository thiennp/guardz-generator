import type { A } from "./test-generic-interface";
import type { TypeGuardFn } from "guardz";
import { isType } from "guardz";

export const isA = <T, U>(
  typeGuardT: TypeGuardFn<T>,
  typeGuardU: TypeGuardFn<U>,
): TypeGuardFn<A<T, U>> => isType<A<T, U>>({ b: typeGuardT, c: typeGuardU });
