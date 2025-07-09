import type { SimpleInterface } from './test-generic-interface';
import { isNumber, isString, isType } from 'guardz';

export const isSimpleInterface = isType<SimpleInterface>({
  name: isString,
  value: isNumber
});
