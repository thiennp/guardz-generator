import type { RecursiveNode } from './recursive-test';
import { isArrayWithEachItem, isString, isType } from 'guardz';

export function isRecursiveNode(value: unknown): value is RecursiveNode {
  return isType<RecursiveNode>({
    value: isString,
    children: isArrayWithEachItem(isRecursiveNode)
  })(value);
}
