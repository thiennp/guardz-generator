// Test file for recursive types

// Simple recursive type
export interface RecursiveNode {
  value: string;
  children: RecursiveNode[];
}

// Self-referencing type
export interface SelfReferencing {
  data: string;
  next: SelfReferencing;
}

// Optional recursive type
export interface OptionalRecursive {
  id: number;
  parent?: OptionalRecursive;
}

// Complex recursive type with multiple references
export interface TreeNode {
  value: number;
  left: TreeNode | null;
  right: TreeNode | null;
}

// Recursive type with other types mixed in
export interface ComplexRecursive {
  name: string;
  metadata: {
    created: Date;
    updated: Date;
  };
  children: ComplexRecursive[];
  parent?: ComplexRecursive;
} 