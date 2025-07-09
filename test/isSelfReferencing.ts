import type { SelfReferencing } from './recursive-test';
import { isString, isType } from 'guardz';

export function isSelfReferencing(value: unknown): value is SelfReferencing {
  return isType<SelfReferencing>({
    data: isString,
  next: isSelfReferencing
  })(value);
}
