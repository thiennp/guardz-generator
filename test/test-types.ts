import type { NonEmptyString, NonNegativeNumber, PositiveNumber, Nullable } from 'guardz';

export interface HintDTO {
  readonly text: string;
  readonly helpText: Nullable<string>;
  readonly type: HintTypeEnum;
}

export interface ContentDTO {
  readonly text: string;
}

export interface UserDTO {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly tags: string[];
  readonly metadata?: Record<string, unknown>;
}

export interface ApiResponse {
  readonly success: boolean;
  readonly data: unknown;
  readonly message?: string;
  readonly errors?: string[];
}

// Type definitions for the example
export enum HintTypeEnum {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
} 