import type { TreeNode } from "./recursive-test";
import { isNullOr, isNumber, isType } from "guardz";

export function isTreeNode(value: unknown): value is TreeNode {
  return isType<TreeNode>({
    value: isNumber,
    left: isNullOr(isTreeNode),
    right: isNullOr(isTreeNode),
  })(value);
}
