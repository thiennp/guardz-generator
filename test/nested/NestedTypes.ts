import type { NonEmptyString, NonNegativeNumber, PositiveNumber, Nullable } from 'guardz';

// Primitives
export interface PrimitiveTypes {
  str: string;
  num: number;
  bool: boolean;
  anyVal: any;
  unknownVal: unknown;
  date: Date;
}

// Nullable, Undefined, Optional
export interface NullableTypes {
  maybeStr: Nullable<string>;
  maybeNum: Nullable<number>;
  maybeBool: Nullable<boolean>;
  maybeDate: Nullable<Date>;
  optStr?: string;
  optNum?: number;
  optBool?: boolean;
  optDate?: Date;
  undefOrStr: string | undefined;
  undefOrNum: number | undefined;
}

// Array types (without generics)
export interface ArrayTypes {
  arr: string[];
  arrOfArr: number[][];
  arrOfNullable: Array<Nullable<string>>;
}

// Object, NonNullObject, Partial, Record
export interface ObjectTypes {
  obj: Record<string, number>;
  nonNullObj: { foo: string };
  partialObj: Partial<{ a: string; b: number }>;
  objWithEach: Record<string, boolean>;
}

// Enum, OneOf, OneOfTypes, EqualTo
export enum StatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

export interface EnumTypes {
  status: StatusEnum;
  oneOf: 'a' | 'b' | 'c';
  oneOfTypes: string | number | boolean;
  equalTo42: 42;
}

// NonEmptyString, NonNegativeNumber, PositiveNumber
export interface SpecialTypes {
  nonEmptyStr: NonEmptyString;
  nonNegNum: NonNegativeNumber;
  posNum: PositiveNumber;
}

// Nested Types (up to 3 levels)
export interface Level3 {
  deep: string;
  deepArr: number[];
}

export interface Level2 {
  mid: Level3;
  midArr: Level3[];
}

export interface Level1 {
  top: Level2;
  topArr: Level2[];
  optTop?: Level2;
}

// Complex DTO with everything
export interface EverythingDTO {
  primitives: PrimitiveTypes;
  nullable: NullableTypes;
  arrays: ArrayTypes;
  objects: ObjectTypes;
  enums: EnumTypes;
  specials: SpecialTypes;
  nested: Level1;
} 