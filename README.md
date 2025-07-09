# guardz-generator

Generate TypeScript type guards from interfaces using the [guardz](https://github.com/thiennp/guardz) library.

## Installation

```bash
npm install guardz-generator
# or
pnpm add guardz-generator
```

## Usage

### Command Line Interface

#### Generate guards for all interfaces in a file

```bash
npx guardz-generator generate src/types.ts --all
```

#### Generate guard for a specific interface

```bash
npx guardz-generator generate src/types.ts --interface HintDTO
```

#### Generate guards for multiple files using glob patterns

```bash
npx guardz-generator generate "src/**/*.ts" --all
npx guardz-generator generate "./models/*.ts" --all
```

#### Generate guard with custom name

```bash
npx guardz-generator generate src/types.ts --interface HintDTO --guard-name validateHint
```

### Programmatic Usage

```typescript
import { TypeGuardGenerator } from 'guardz-generator';

// Create generator
const generator = new TypeGuardGenerator(['src/types.ts']);

// Generate guards for all interfaces
const generatedFiles = generator.generateAllTypeGuards();

// Write files to directory
generator.writeTypeGuardsToFiles(generatedFiles, './generated');

// Or generate for specific interface
const code = generator.generateTypeGuard('HintDTO');
```

## Example

Given a TypeScript file `sometypes.ts`:

```typescript
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
  readonly id: NonNegativeNumber;
  readonly name: NonEmptyString;
  readonly email: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly tags: string[];
  readonly metadata?: Record<string, unknown>;
}

export enum HintTypeEnum {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
}
```

Running:

```bash
npx guardz-generator generate sometypes.ts --all
```

Will generate files in the same folder as `sometypes.ts`:

**isHintDTO.ts:**
```typescript
import type { HintDTO, Nullable, HintTypeEnum } from './sometypes';
import { 
  isType, 
  isString, 
  isNumber, 
  isBoolean, 
  isDate, 
  isArrayWithEachItem, 
  isObjectWithEachItem,
  isUndefinedOr, 
  isNullOr, 
  isOneOf, 
  isNull, 
  isUndefined, 
  isAny, 
  isUnknown, 
  isEqualTo,
  isEnum,
  isNonEmptyString,
  isNonNegativeNumber,
  isPositiveNumber,
  isNonEmptyArrayWithEachItem 
} from 'guardz';

const isHintDTO = isType<HintDTO>({
  text: isString,
  helpText: isNullOr(isString),
  type: isEnum(HintTypeEnum)
});

export { isHintDTO };
```

**isContentDTO.ts:**
```typescript
import type { ContentDTO } from './sometypes';
import { 
  isType, 
  isString, 
  isNumber, 
  isBoolean, 
  isDate, 
  isArrayWithEachItem, 
  isObjectWithEachItem,
  isUndefinedOr, 
  isNullOr, 
  isOneOf, 
  isNull, 
  isUndefined, 
  isAny, 
  isUnknown, 
  isEqualTo,
  isEnum,
  isNonEmptyString,
  isNonNegativeNumber,
  isPositiveNumber,
  isNonEmptyArrayWithEachItem 
} from 'guardz';

const isContentDTO = isType<ContentDTO>({
  text: isString
});

export { isContentDTO };
```

**isUserDTO.ts:**
```typescript
import type { UserDTO, NonNegativeNumber, NonEmptyString } from './sometypes';
import { 
  isType, 
  isString, 
  isNumber, 
  isBoolean, 
  isDate, 
  isArrayWithEachItem, 
  isObjectWithEachItem,
  isUndefinedOr, 
  isNullOr, 
  isOneOf, 
  isNull, 
  isUndefined, 
  isAny, 
  isUnknown, 
  isEqualTo,
  isEnum,
  isNonEmptyString,
  isNonNegativeNumber,
  isPositiveNumber,
  isNonEmptyArrayWithEachItem 
} from 'guardz';

const isUserDTO = isType<UserDTO>({
  id: isNonNegativeNumber,
  name: isNonEmptyString,
  email: isString,
  isActive: isBoolean,
  createdAt: isDate,
  tags: isArrayWithEachItem(isString),
  metadata: isUndefinedOr(isObjectWithEachItem(isUnknown))
});

export { isUserDTO };
```

## Supported Types

The generator supports the following TypeScript types:

- **Primitive types**: `string`, `number`, `boolean`, `any`, `unknown`
- **Complex types**: `Date`, `Array<T>`, `Nullable<T>`, `Record<K, V>`
- **Union types**: `string | null`, `number | undefined`
- **Optional properties**: `property?: string`
- **Readonly properties**: `readonly property: string`
- **Enums**: `enum StatusEnum`
- **Nested types**: Up to 3 levels deep
- **Literal types**: `42`, `'specific-string'`
- **Guardz types**: `NonEmptyString`, `NonNegativeNumber`, `PositiveNumber`, `Nullable<T>`

**Note**: Generic types (like `ApiResponse<T>`) are not currently supported. Use concrete types instead.

## Testing

The package includes comprehensive tests in the `test/` folder:

```bash
# Run the test suite
node test/test-runner.js

# Test specific files
npx guardz-generator generate test/test-types.ts --all
npx guardz-generator generate test/test-types-comprehensive.ts --all
```

The test files cover:
- All primitive types
- Nullable and optional types
- Arrays and nested arrays
- Objects and records
- Enums and unions
- Nested types up to 3 levels
- Complex DTOs with all features

## Configuration

### TypeScript Configuration

Make sure your `tsconfig.json` includes the necessary compiler options:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true
  }
}
```

## License

MIT 