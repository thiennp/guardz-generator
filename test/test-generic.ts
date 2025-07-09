export type A<T, U> = {
  b: T;
  c: U;
};

export type SimpleAlias = string;

export type ComplexGeneric<T> = {
  id: number;
  data: T;
  optional?: string;
};

export interface RegularInterface {
  name: string;
  value: number;
} 