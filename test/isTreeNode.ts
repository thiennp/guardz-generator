import type { TreeNode } from './recursive-test';
import { isEqualTo, isNumber, isOneOfTypes, isType } from 'guardz';

export function isTreeNode(value: unknown): value is TreeNode {
  return isType<TreeNode>({
    value: isNumber,
  left: isOneOfTypes<null | TreeNode>(isEqualTo(null), isTreeNode),
  right: isOneOfTypes<null | TreeNode>(isEqualTo(null), isTreeNode)
  })(value);
}
