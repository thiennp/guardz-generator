import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export interface TypeGuardOptions {
  interfaceName?: string;
  outputDir?: string;
  guardName?: string;
  generateSeparateFiles?: boolean;
}

export interface GeneratedFile {
  fileName: string;
  content: string;
  interfaceName: string;
}

export class TypeGuardGenerator {
  private program: ts.Program;
  private checker: ts.TypeChecker;
  private sourceFiles: ts.SourceFile[];

  constructor(sourceFiles: string[]) {
    this.program = ts.createProgram(sourceFiles, {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    });
    this.checker = this.program.getTypeChecker();
    this.sourceFiles = this.program.getSourceFiles().filter(sf => !sf.isDeclarationFile);
  }

  generateAllTypeGuards(options: Partial<TypeGuardOptions> = {}): GeneratedFile[] {
    const interfaces: ts.InterfaceDeclaration[] = [];
    for (const sourceFile of this.sourceFiles) {
      ts.forEachChild(sourceFile, (node: ts.Node) => {
        if (ts.isInterfaceDeclaration(node)) {
          interfaces.push(node);
        }
      });
    }
    return interfaces.map(interfaceDecl => {
      const guardName = options.guardName || `is${interfaceDecl.name.text}`;
      const typeGuardCode = this.generateTypeGuardCode(interfaceDecl, guardName);
      const fileName = `${guardName}.ts`;
      // Place the generated file in the same directory as the interface definition
      const outputDir = path.dirname(interfaceDecl.getSourceFile().fileName);
      const importTypes = this.collectReferencedTypes(interfaceDecl);
      return {
        fileName: path.join(outputDir, fileName),
        content: this.generateCompleteFile(guardName, typeGuardCode, interfaceDecl.name.text, importTypes, fileName, outputDir),
        interfaceName: interfaceDecl.name.text
      };
    });
  }

  private findInterfaceWithSourceFile(interfaceName: string): [ts.InterfaceDeclaration, ts.SourceFile] | null {
    for (const sourceFile of this.sourceFiles) {
      let found: ts.InterfaceDeclaration | null = null;
      ts.forEachChild(sourceFile, (node: ts.Node) => {
        if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName && !found) {
          found = node;
        }
      });
      if (found) {
        return [found, sourceFile];
      }
    }
    return null;
  }

  generateTypeGuard(interfaceName: string, options: Partial<TypeGuardOptions> = {}): string {
    const found = this.findInterfaceWithSourceFile(interfaceName);
    if (!found) {
      throw new Error(`Interface '${interfaceName}' not found in source files`);
    }
    const [targetInterface] = found;
    const guardName = options.guardName || `is${interfaceName}`;
    const typeGuardCode = this.generateTypeGuardCode(targetInterface, guardName);
    const importTypes = this.collectReferencedTypes(targetInterface);
    const outputDir = path.dirname(targetInterface.getSourceFile().fileName);
    const fileName = `${guardName}.ts`;
    return this.generateCompleteFile(guardName, typeGuardCode, interfaceName, importTypes, fileName, outputDir);
  }

  writeTypeGuardsToFiles(generatedFiles: GeneratedFile[], outputDir: string): void {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    for (const file of generatedFiles) {
      const filePath = path.join(outputDir, file.fileName);
      fs.writeFileSync(filePath, file.content);
      console.log(`✅ Generated: ${filePath}`);
    }
  }

  private generateTypeGuardCode(interfaceDecl: ts.InterfaceDeclaration, guardName: string): string {
    const properties = this.extractProperties(interfaceDecl);
    const propertyGuards = properties.map(prop => this.generatePropertyGuard(prop)).join(',\n  ');
    return `export const ${guardName} = isType<${interfaceDecl.name.text}>({\n  ${propertyGuards}\n});`;
  }

  private extractProperties(interfaceDecl: ts.InterfaceDeclaration): Array<{
    name: string;
    type: ts.TypeNode;
    isOptional: boolean;
  }> {
    const properties: Array<{
      name: string;
      type: ts.TypeNode;
      isOptional: boolean;
    }> = [];
    interfaceDecl.members.forEach((member: ts.TypeElement) => {
      if (ts.isPropertySignature(member) && member.name) {
        const name = member.name.getText();
        const type = member.type;
        const isOptional = member.questionToken !== undefined;
        if (type) {
          properties.push({ name, type, isOptional });
        }
      }
    });
    return properties;
  }

  private generatePropertyGuard(property: {
    name: string;
    type: ts.TypeNode;
    isOptional: boolean;
  }): string {
    const typeGuard = this.convertTypeToGuard(property.type);
    console.log(`Debug: Property ${property.name} generated guard: ${typeGuard}`);
    if (property.isOptional) {
      return `${property.name}: isUndefinedOr(${typeGuard})`;
    } else {
      return `${property.name}: ${typeGuard}`;
    }
  }

  private convertTypeToGuard(typeNode: ts.TypeNode): string {
    if (ts.isUnionTypeNode(typeNode)) {
      return this.handleUnionType(typeNode);
    } else if (ts.isTypeReferenceNode(typeNode)) {
      return this.handleTypeReference(typeNode);
    } else if (ts.isTypeLiteralNode(typeNode)) {
      return this.handleTypeLiteral(typeNode);
    } else if (ts.isArrayTypeNode(typeNode)) {
      return this.handleArrayType(typeNode);
    } else if (ts.isLiteralTypeNode(typeNode)) {
      return this.handleLiteralType(typeNode);
    } else {
      return this.handlePrimitiveType(typeNode);
    }
  }

  private handleUnionType(unionType: ts.UnionTypeNode): string {
    const types = unionType.types;
    if (types.length === 2) {
      const typeText = unionType.getText();
      if (typeText === 'string | null') {
        return 'isNullOr(isString)';
      }
      if (typeText === 'string | undefined') {
        return 'isUndefinedOr(isString)';
      }
      if (typeText === 'number | undefined') {
        return 'isUndefinedOr(isNumber)';
      }
      if (typeText === 'boolean | undefined') {
        return 'isUndefinedOr(isBoolean)';
      }
      if (typeText === 'Date | undefined') {
        return 'isUndefinedOr(isDate)';
      }
    }

    // Check if all types are literal types (string literals, numbers, etc.)
    const allLiterals = types.every((type: ts.TypeNode) => 
      ts.isLiteralTypeNode(type) && 
      (type.literal.kind === ts.SyntaxKind.StringLiteral || 
       type.literal.kind === ts.SyntaxKind.NumericLiteral ||
       type.literal.kind === ts.SyntaxKind.BooleanKeyword)
    );

    if (allLiterals) {
      // For literal unions like 'a' | 'b' | 'c', use isOneOf with values
      const literalValues = types.map((type: ts.TypeNode) => {
        if (ts.isLiteralTypeNode(type)) {
          return type.literal.getText();
        }
        return '';
      }).filter(Boolean);
      return `isOneOf(${literalValues.join(', ')})`;
    }

    // For type unions like string | number | boolean, use isOneOfTypes
    // 1. Extract type names and their corresponding guard expressions
    const typePairs = types.map((type: ts.TypeNode) => {
      let typeName = '';
      if (ts.isTypeReferenceNode(type)) {
        typeName = type.typeName.getText();
      } else if (ts.isLiteralTypeNode(type)) {
        typeName = type.getText();
      } else if (ts.isTypeLiteralNode(type)) {
        typeName = type.getText();
      } else {
        typeName = type.getText();
      }
      return {
        typeName,
        guard: this.convertTypeToGuard(type)
      };
    });
    // 2. Sort by typeName alphabetically
    typePairs.sort((a, b) => a.typeName.localeCompare(b.typeName));
    // 3. Build the generic type string and guard arguments
    const genericType = typePairs.map(pair => pair.typeName).join(' | ');
    const guardArgs = typePairs.map(pair => pair.guard).join(', ');
    return `isOneOfTypes<${genericType}>(${guardArgs})`;
  }

  private handleTypeReference(typeRef: ts.TypeReferenceNode): string {
    const typeName = typeRef.typeName.getText();
    console.log(`Debug: Handling type reference: ${typeName}`);
    
    switch (typeName) {
      case 'string': {
        return 'isString';
      }
      case 'number': {
        return 'isNumber';
      }
      case 'boolean': {
        return 'isBoolean';
      }
      case 'Date': {
        return 'isDate';
      }
      case 'Array':
      case 'array': {
        if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
          const elementType = this.convertTypeToGuard(typeRef.typeArguments[0]);
          return `isArrayWithEachItem(${elementType})`;
        }
        return 'isArrayWithEachItem(isUnknown)';
      }
      case 'Nullable': {
        if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
          const innerType = this.convertTypeToGuard(typeRef.typeArguments[0]);
          return `isNullOr(${innerType})`;
        }
        return 'isNullOr(isUnknown)';
      }
      case 'Record': {
        if (typeRef.typeArguments && typeRef.typeArguments.length >= 2) {
          const valueType = this.convertTypeToGuard(typeRef.typeArguments[1]);
          return `isObjectWithEachItem(${valueType})`;
        }
        return 'isObjectWithEachItem(isUnknown)';
      }
      case 'NonEmptyString': {
        return 'isNonEmptyString';
      }
      case 'NonNegativeNumber': {
        return 'isNonNegativeNumber';
      }
      case 'PositiveNumber': {
        return 'isPositiveNumber';
      }
      case 'NonEmptyArray': {
        if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
          const elementType = this.convertTypeToGuard(typeRef.typeArguments[0]);
          return `isNonEmptyArrayWithEachItem(${elementType})`;
        }
        return 'isNonEmptyArrayWithEachItem(isUnknown)';
      }
      case 'Partial': {
        console.log(`Debug: Processing Partial with ${typeRef.typeArguments?.length || 0} type arguments`);
        if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
          const arg = typeRef.typeArguments[0];
          console.log(`Debug: Partial argument type: ${arg.getText()}`);
          let innerTypeGuard;
          if (ts.isTypeLiteralNode(arg)) {
            // Inline object type: generate just the object literal, not isType({ ... })
            console.log(`Debug: Partial argument is TypeLiteral`);
            innerTypeGuard = this.handleTypeLiteral(arg, /*wrapInIsType*/ false);
          } else {
            console.log(`Debug: Partial argument is not TypeLiteral`);
            innerTypeGuard = this.convertTypeToGuard(arg);
          }
          console.log(`Debug: Generated innerTypeGuard: ${innerTypeGuard}`);
          return `isPartialOf(${innerTypeGuard})`;
        }
        console.log(`Debug: Partial has no type arguments`);
        return 'isPartialOf(isUnknown)';
      }
      default: {
        const isEnum = this.isEnumType(typeName);
        if (isEnum) {
          return `isEnum(${typeName})`;
        }
        // Check if this is an interface that has a corresponding type guard
        if (this.isInterfaceType(typeName)) {
          return `is${typeName}`;
        }
        return `isType<${typeName}>({})`;
      }
    }
  }

  private handleTypeLiteral(typeLiteral: ts.TypeLiteralNode, wrapInIsType: boolean = true): string {
    const properties = typeLiteral.members.map((member: ts.TypeElement) => {
      if (ts.isPropertySignature(member) && member.name && member.type) {
        const name = member.name.getText();
        const typeGuard = this.convertTypeToGuard(member.type);
        const isOptional = member.questionToken !== undefined;
        if (isOptional) {
          return `  ${name}: isUndefinedOr(${typeGuard})`;
        } else {
          return `  ${name}: ${typeGuard}`;
        }
      }
      return '';
    }).filter(Boolean);
    const objectLiteral = `{
${properties.join(',\n')}
}`;
    return wrapInIsType ? `isType(${objectLiteral})` : objectLiteral;
  }

  private handleArrayType(arrayType: ts.ArrayTypeNode): string {
    const elementType = this.convertTypeToGuard(arrayType.elementType);
    return `isArrayWithEachItem(${elementType})`;
  }

  private handleLiteralType(literalType: ts.LiteralTypeNode): string {
    if (literalType.literal.kind === ts.SyntaxKind.NullKeyword) {
      return 'isEqualTo(null)';
    } else if (literalType.literal.kind === ts.SyntaxKind.UndefinedKeyword) {
      return 'isEqualTo(undefined)';
    } else {
      const value = literalType.literal.getText();
      return `isEqualTo(${value})`;
    }
  }

  private handlePrimitiveType(typeNode: ts.TypeNode): string {
    const typeText = typeNode.getText();
    
    switch (typeText) {
      case 'string':
        return 'isString';
      case 'number':
        return 'isNumber';
      case 'boolean':
        return 'isBoolean';
      case 'any':
        return 'isAny';
      case 'unknown':
        return 'isUnknown';
      case 'null':
        return 'isEqualTo(null)';
      case 'undefined':
        return 'isEqualTo(undefined)';
      default: {
        // wrap in block to fix no-case-declarations
        return 'isUnknown';
      }
    }
  }

  private isEnumType(typeName: string): boolean {
    for (const sourceFile of this.sourceFiles) {
      let found = false;
      ts.forEachChild(sourceFile, (node: ts.Node) => {
        if (ts.isEnumDeclaration(node) && node.name.text === typeName) {
          found = true;
        }
      });
      if (found) return true;
    }
    return false;
  }

  private isInterfaceType(typeName: string): boolean {
    for (const sourceFile of this.sourceFiles) {
      let found = false;
      ts.forEachChild(sourceFile, (node: ts.Node) => {
        if (ts.isInterfaceDeclaration(node) && node.name.text === typeName) {
          found = true;
        }
      });
      if (found) return true;
    }
    return false;
  }

  // Collect all referenced types/interfaces/enums for import
  private collectReferencedTypes(interfaceDecl: ts.InterfaceDeclaration): string[] {
    const referenced = new Set<string>();
    referenced.add(interfaceDecl.name.text);
    
    const visit = (typeNode: ts.TypeNode | undefined) => {
      if (!typeNode) return;
      if (ts.isTypeReferenceNode(typeNode)) {
        const typeName = typeNode.typeName.getText();
        // Don't add enums to type imports since they're used at runtime
        // Don't add built-in types that don't need imports
        if (!this.isEnumType(typeName) && !this.isBuiltInType(typeName) && !this.isTypeAlias(typeName)) {
          referenced.add(typeName);
        }
        if (typeNode.typeArguments) {
          typeNode.typeArguments.forEach(visit);
        }
      } else if (ts.isArrayTypeNode(typeNode)) {
        visit(typeNode.elementType);
      } else if (ts.isUnionTypeNode(typeNode)) {
        typeNode.types.forEach(visit);
      } else if (ts.isTypeLiteralNode(typeNode)) {
        typeNode.members.forEach((member: ts.TypeElement) => {
          if (ts.isPropertySignature(member) && member.type) {
            visit(member.type);
          }
        });
      }
    };
    
    interfaceDecl.members.forEach((member: ts.TypeElement) => {
      if (ts.isPropertySignature(member) && member.type) {
        visit(member.type);
      }
    });
    
    return Array.from(referenced);
  }

  // Check if a type is a built-in type that doesn't need imports
  private isBuiltInType(typeName: string): boolean {
    const builtInTypes = [
      'string', 'number', 'boolean', 'any', 'unknown', 'null', 'undefined',
      'Date', 'Array', 'Promise', 'Map', 'Set', 'RegExp', 'Error',
      'Object', 'Function', 'Symbol', 'BigInt', 'Partial'
    ];
    return builtInTypes.includes(typeName);
  }

  // Check if a type is a type alias that doesn't need imports
  private isTypeAlias(typeName: string): boolean {
    const typeAliases = [
      'Nullable', 'NonEmptyString', 'NonNegativeNumber', 'PositiveNumber', 'NonEmptyArray'
    ];
    return typeAliases.includes(typeName);
  }

  private generateCompleteFile(
    guardName: string,
    typeGuardCode: string,
    interfaceName: string,
    importTypes: string[],
    fileName: string,
    outputDir: string
  ): string {
    // Collect enums used in this interface
    const usedEnums = this.collectUsedEnums(interfaceName);
    
    // Collect enums used in the generated type guard code
    const usedEnumsInCode = this.collectUsedEnumsInCode(typeGuardCode);
    
    // Collect guardz utilities used in the generated code
    const usedGuardzUtilities = this.collectUsedGuardzUtilities(typeGuardCode);
    
    // Collect type guard functions used in the generated code
    const usedTypeGuards = this.collectUsedTypeGuards(typeGuardCode);

    // Only import types that are actually referenced in the generated code
    const usedTypes = importTypes.filter(type => new RegExp(`\\b${type}\\b`).test(typeGuardCode));
    // For each used type, resolve its source file and compute the relative import path
    const typeImportsArr: string[] = [];
    const enumImportsArr: string[] = [];
    for (const type of usedTypes) {
      const typeSourceFile = findTypeSourceFile(type, this.sourceFiles);
      if (typeSourceFile) {
        const relPath = './' + path.relative(outputDir, typeSourceFile).replace(/\\/g, '/').replace(/\.ts$/, '');
        // Check if it's an enum
        if (this.isEnumType(type)) {
          enumImportsArr.push(`import { ${type} } from '${relPath}';`);
        } else {
          typeImportsArr.push(`import type { ${type} } from '${relPath}';`);
        }
      }
    }
    
    // Add imports for enums used in the generated code
    for (const enumName of usedEnumsInCode) {
      const enumSourceFile = findTypeSourceFile(enumName, this.sourceFiles);
      if (enumSourceFile) {
        const relPath = './' + path.relative(outputDir, enumSourceFile).replace(/\\/g, '/').replace(/\.ts$/, '');
        enumImportsArr.push(`import { ${enumName} } from '${relPath}';`);
      }
    }
    const typeImports = typeImportsArr.join('\n');
    const enumImports = enumImportsArr.join('\n');
    const guardzImports = usedGuardzUtilities.length > 0 ? `import { ${usedGuardzUtilities.join(', ')} } from 'guardz';` : '';
    // Filter out the current type guard to avoid circular imports
    const filteredTypeGuards = usedTypeGuards.filter(name => name !== guardName && new RegExp(`\\b${name}\\b`).test(typeGuardCode));
    console.log(`Debug: Found type guards for ${guardName}:`, filteredTypeGuards);
    // Import type guards from their individual files (relative to outputDir)
    const typeGuardImports = filteredTypeGuards.map(name => {
      // Find the actual source file for this type guard
      const typeGuardSourceFile = this.findTypeGuardSourceFile(name);
      console.log(`Debug: Type guard ${name} source file:`, typeGuardSourceFile);
      if (typeGuardSourceFile) {
        const relPath = './' + path.relative(outputDir, typeGuardSourceFile).replace(/\\/g, '/').replace(/\.ts$/, '');
        console.log(`Debug: Import path for ${name}:`, relPath);
        return `import { ${name} } from '${relPath}';`;
      }
      // Fallback to same directory if not found
      const guardFile = `${name}.ts`;
      const relPath = './' + path.relative(outputDir, path.join(outputDir, guardFile)).replace(/\\/g, '/').replace(/\.ts$/, '');
      console.log(`Debug: Fallback import path for ${name}:`, relPath);
      return `import { ${name} } from '${relPath}';`;
    }).join('\n');
    const allImports = [typeImports, enumImports, guardzImports, typeGuardImports].filter(Boolean);
    const importsSection = allImports.join('\n');
    
    return `${importsSection}${importsSection ? '\n' : ''}${typeGuardCode}\n`;
  }

  // Collect enums used in the generated typeguard code
  private collectUsedEnums(interfaceName: string): string[] {
    const usedEnums = new Set<string>();
    
    // Find the interface and check its properties for enum usage
    for (const sourceFile of this.sourceFiles) {
      ts.forEachChild(sourceFile, (node: ts.Node) => {
        if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
          node.members.forEach((member: ts.TypeElement) => {
            if (ts.isPropertySignature(member) && member.type) {
              const typeName = this.getTypeName(member.type);
              if (typeName && this.isEnumType(typeName)) {
                usedEnums.add(typeName);
              }
            }
          });
        }
      });
    }
    
    return Array.from(usedEnums);
  }

  // Collect enums used in the generated type guard code
  private collectUsedEnumsInCode(typeGuardCode: string): string[] {
    const usedEnums = new Set<string>();
    
    // Look for enum usage patterns like isEnum(EnumName)
    const enumPattern = /isEnum\(([A-Z][a-zA-Z0-9_]*)\)/g;
    let match;
    while ((match = enumPattern.exec(typeGuardCode)) !== null) {
      usedEnums.add(match[1]);
    }
    
    return Array.from(usedEnums);
  }

  // Collect guardz utilities used in the generated typeguard code
  private collectUsedGuardzUtilities(typeGuardCode: string): string[] {
    const usedUtilities = new Set<string>();
    
    // Always include isType since it's the base function
    usedUtilities.add('isType');
    
    // Check for specific utilities in the generated code
    const utilityChecks = [
      { pattern: 'isString', utility: 'isString' },
      { pattern: 'isNumber', utility: 'isNumber' },
      { pattern: 'isBoolean', utility: 'isBoolean' },
      { pattern: 'isDate', utility: 'isDate' },
      { pattern: 'isArrayWithEachItem', utility: 'isArrayWithEachItem' },
      { pattern: 'isObjectWithEachItem', utility: 'isObjectWithEachItem' },
      { pattern: 'isUndefinedOr', utility: 'isUndefinedOr' },
      { pattern: 'isNullOr', utility: 'isNullOr' },
      { pattern: 'isOneOf', utility: 'isOneOf' },
      { pattern: 'isOneOfTypes', utility: 'isOneOfTypes' },
      { pattern: 'isEqualTo', utility: 'isEqualTo' },
      { pattern: 'isAny', utility: 'isAny' },
      { pattern: 'isUnknown', utility: 'isUnknown' },
      { pattern: 'isEnum', utility: 'isEnum' },
      { pattern: 'isNonEmptyString', utility: 'isNonEmptyString' },
      { pattern: 'isNonNegativeNumber', utility: 'isNonNegativeNumber' },
      { pattern: 'isPositiveNumber', utility: 'isPositiveNumber' },
      { pattern: 'isNonEmptyArrayWithEachItem', utility: 'isNonEmptyArrayWithEachItem' },
      { pattern: 'isPartialOf', utility: 'isPartialOf' }
    ];
    
    for (const check of utilityChecks) {
      if (typeGuardCode.includes(check.pattern)) {
        usedUtilities.add(check.utility);
      }
    }
    
    return Array.from(usedUtilities).sort();
  }

  // Collect type guard functions used in the generated typeguard code
  private collectUsedTypeGuards(typeGuardCode: string): string[] {
    const usedTypeGuards = new Set<string>();
    // Match type guard function calls and property values (isXxx followed by parentheses, commas, end of line, or used as values)
    const typeGuardPattern = /\bis([A-Z][a-zA-Z0-9_]*)\b(?=\s*[,(]|\s*$|\s*:|\s*})/g;
    let match;
    const guardzUtilities = [
      'isString', 'isNumber', 'isBoolean', 'isDate', 'isArrayWithEachItem', 
      'isObjectWithEachItem', 'isUndefinedOr', 'isNullOr', 'isOneOf', 'isOneOfTypes',
      'isEqualTo', 'isAny', 'isUnknown', 'isEnum', 'isNonEmptyString', 
      'isNonNegativeNumber', 'isPositiveNumber', 'isNonEmptyArrayWithEachItem', 'isType', 'isPartialOf'
    ];
    while ((match = typeGuardPattern.exec(typeGuardCode)) !== null) {
      const typeGuardName = match[0];
      if (!guardzUtilities.includes(typeGuardName)) {
        usedTypeGuards.add(typeGuardName);
      }
    }
    return Array.from(usedTypeGuards).sort();
  }

  // Helper to get type name from a type node
  private getTypeName(typeNode: ts.TypeNode): string | null {
    if (ts.isTypeReferenceNode(typeNode)) {
      return typeNode.typeName.getText();
    }
    return null;
  }

  // Helper to find the source file for a type guard function
  private findTypeGuardSourceFile(typeGuardName: string): string | undefined {
    // Remove 'is' prefix to get the interface name
    const interfaceName = typeGuardName.replace(/^is/, '');
    for (const sf of this.sourceFiles) {
      let found = false;
      ts.forEachChild(sf, (node: ts.Node) => {
        if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
          found = true;
        }
      });
      if (found) {
        // The generated type guard will be in the same directory as the interface
        const dir = path.dirname(sf.fileName);
        return path.join(dir, `${typeGuardName}.ts`);
      }
    }
    return undefined;
  }
} 

// Helper to find the source file path for a given type name
function findTypeSourceFile(typeName: string, sourceFiles: ts.SourceFile[]): string | undefined {
  for (const sf of sourceFiles) {
    let found = false;
    ts.forEachChild(sf, (node: ts.Node) => {
      if (
        (ts.isInterfaceDeclaration(node) || ts.isEnumDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
        node.name && node.name.text === typeName
      ) {
        found = true;
      }
    });
    if (found) return sf.fileName;
  }
  return undefined;
} 