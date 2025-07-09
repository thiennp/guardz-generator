// Complex test file with all guardz utilities and nested structures

import type { NonEmptyString, NonNegativeNumber, PositiveNumber, NonEmptyArray, Nullable } from 'guardz';

export enum TestStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Level 3 - Deep nested types
export interface DeepNestedData {
  id: NonEmptyString;
  value: NonNegativeNumber;
  isActive: boolean;
  tags: NonEmptyArray<NonEmptyString>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: PositiveNumber;
  };
  settings: {
    enabled: boolean;
    timeout: PositiveNumber;
    retries: NonNegativeNumber;
  };
}

// Level 2 - Mid-level types that use Level 3
export interface UserProfile {
  userId: NonEmptyString;
  username: NonEmptyString;
  email: string;
  age: PositiveNumber;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: 'en' | 'es' | 'fr';
    notifications: boolean;
  };
  deepData: DeepNestedData;
  deepDataArray: NonEmptyArray<DeepNestedData>;
  optionalDeepData?: DeepNestedData;
  nullableDeepData: Nullable<DeepNestedData>;
}

// Level 1 - Top-level types that use Level 2
export interface ComplexUser {
  id: NonEmptyString;
  name: NonEmptyString;
  profile: UserProfile;
  profiles: NonEmptyArray<UserProfile>;
  status: TestStatus;
  priority: Priority;
  scores: NonEmptyArray<PositiveNumber>;
  metadata: {
    created: Date;
    lastLogin: Date;
    loginCount: NonNegativeNumber;
    isVerified: boolean;
  };
  settings: {
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    privacy: {
      publicProfile: boolean;
      showEmail: boolean;
      allowMessages: boolean;
    };
  };
  optionalProfile?: UserProfile;
  nullableProfile: Nullable<UserProfile>;
  anyData: any;
  unknownData: unknown;
  literalValue: 'specific' | 'exact' | 'value';
  numberLiteral: 42;
  booleanLiteral: true;
  stringLiteral: 'hello';
  nullValue: null;
  undefinedValue: undefined;
}

// Another complex type that references the first one
export interface SystemConfig {
  systemId: NonEmptyString;
  version: NonEmptyString;
  users: NonEmptyArray<ComplexUser>;
  activeUsers: NonEmptyArray<ComplexUser>;
  inactiveUsers: NonEmptyArray<ComplexUser>;
  settings: {
    maxUsers: PositiveNumber;
    timeout: NonNegativeNumber;
    features: {
      advanced: boolean;
      premium: boolean;
      beta: boolean;
    };
    limits: {
      storage: PositiveNumber;
      bandwidth: NonNegativeNumber;
      requests: PositiveNumber;
    };
  };
  status: TestStatus;
  priority: Priority;
  metadata: {
    deployed: Date;
    lastUpdate: Date;
    version: NonEmptyString;
  };
  deepConfig: {
    nested: {
      very: {
        deep: {
          value: NonEmptyString;
          count: PositiveNumber;
          enabled: boolean;
        };
      };
    };
  };
  partialConfig: Partial<{
    optionalField: NonEmptyString;
    optionalNumber: PositiveNumber;
    optionalBoolean: boolean;
  }>;
  recordConfig: Record<NonEmptyString, NonEmptyString>;
  arrayConfig: NonEmptyArray<{
    key: NonEmptyString;
    value: NonEmptyString;
    count: PositiveNumber;
  }>;
  unionConfig: NonEmptyString | NonEmptyArray<PositiveNumber> | boolean;
  complexUnion: ComplexUser | DeepNestedData;
  anyConfig: any;
  unknownConfig: unknown;
  literalUnion: 'option1' | 'option2' | 'option3';
  numberUnion: 1 | 2 | 3 | 4 | 5;
  booleanUnion: true | false;
  nullUnion: null | NonEmptyString;
  undefinedUnion: undefined | PositiveNumber;
} 