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
      const sf = sourceFileOf(interfaceDecl);
      const importTypes = this.collectReferencedTypes(interfaceDecl, sf);
      const importPath = './' + path.basename(sf.fileName, '.ts');
      return {
        fileName,
        content: this.generateCompleteFile(guardName, typeGuardCode, interfaceDecl.name.text, importTypes, importPath),
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
    const [targetInterface, targetSourceFile] = found;
    const guardName = options.guardName || `is${interfaceName}`;
    const typeGuardCode = this.generateTypeGuardCode(targetInterface, guardName);
    const importTypes = this.collectReferencedTypes(targetInterface, targetSourceFile);
    const importPath = './' + path.basename(targetSourceFile.fileName, '.ts');
    return this.generateCompleteFile(guardName, typeGuardCode, interfaceName, importTypes, importPath);
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
    return `const ${guardName} = isType<${interfaceDecl.name.text}>({\n  ${propertyGuards}\n});`;
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
    const typeGuards = types.map((type: ts.TypeNode) => this.convertTypeToGuard(type));
    return `isOneOfTypes(${typeGuards.join(', ')})`;
  }

  private handleTypeReference(typeRef: ts.TypeReferenceNode): string {
    const typeName = typeRef.typeName.getText();
    
    switch (typeName) {
      case 'string':
        return 'isString';
      case 'number':
        return 'isNumber';
      case 'boolean':
        return 'isBoolean';
      case 'Date':
        return 'isDate';
      case 'Array':
      case 'array':
        if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
          const elementType = this.convertTypeToGuard(typeRef.typeArguments[0]);
          return `isArrayWithEachItem(${elementType})`;
        }
        return 'isArrayWithEachItem(isUnknown)';
      case 'Nullable':
        if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
          const innerType = this.convertTypeToGuard(typeRef.typeArguments[0]);
          return `isNullOr(${innerType})`;
        }
        return 'isNullOr(isUnknown)';
      case 'Record':
        if (typeRef.typeArguments && typeRef.typeArguments.length >= 2) {
          const keyType = this.convertTypeToGuard(typeRef.typeArguments[0]);
          const valueType = this.convertTypeToGuard(typeRef.typeArguments[1]);
          return `isObjectWithEachItem(${valueType})`;
        }
        return 'isObjectWithEachItem(isUnknown)';
      case 'NonEmptyString':
        return 'isNonEmptyString';
      case 'NonNegativeNumber':
        return 'isNonNegativeNumber';
      case 'PositiveNumber':
        return 'isPositiveNumber';
      case 'NonEmptyArray':
        if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
          const elementType = this.convertTypeToGuard(typeRef.typeArguments[0]);
          return `isNonEmptyArrayWithEachItem(${elementType})`;
        }
        return 'isNonEmptyArrayWithEachItem(isUnknown)';
      default:
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

  private handleTypeLiteral(typeLiteral: ts.TypeLiteralNode): string {
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
    return `isType({\n${properties.join(',\n')}\n})`;
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
      default:
        return 'isUnknown';
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
  private collectReferencedTypes(interfaceDecl: ts.InterfaceDeclaration, sourceFile: ts.SourceFile): string[] {
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
      'Object', 'Function', 'Symbol', 'BigInt'
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
    importPath: string
  ): string {
    // Collect enums used in this interface
    const usedEnums = this.collectUsedEnums(interfaceName, importPath);
    
    // Collect guardz utilities used in the generated code
    const usedGuardzUtilities = this.collectUsedGuardzUtilities(typeGuardCode);
    
    // Collect type guard functions used in the generated code
    const usedTypeGuards = this.collectUsedTypeGuards(typeGuardCode);

    // Only import types that are actually referenced in the generated code
    const usedTypes = importTypes.filter(type => new RegExp(`\\b${type}\\b`).test(typeGuardCode));
    const typeImports = usedTypes.length > 0 ? `import type { ${usedTypes.join(', ')} } from '${importPath}';` : '';
    const enumImports = usedEnums.length > 0 ? `import { ${usedEnums.join(', ')} } from '${importPath}';` : '';
    const guardzImports = usedGuardzUtilities.length > 0 ? `import { ${usedGuardzUtilities.join(', ')} } from 'guardz';` : '';
    
    // Filter out the current type guard to avoid circular imports
    const filteredTypeGuards = usedTypeGuards.filter(name => name !== guardName && new RegExp(`\\b${name}\\b`).test(typeGuardCode));
    // Import type guards from their individual files
    const typeGuardImports = filteredTypeGuards.map(name => `import { ${name} } from './${name}';`).join('\n');
    
    const allImports = [typeImports, enumImports, guardzImports, typeGuardImports].filter(Boolean);
    const importsSection = allImports.join('\n');
    
    return `${importsSection}${importsSection ? '\n' : ''}${typeGuardCode}\n\nexport { ${guardName} };\n`;
  }

  // Collect enums used in the generated typeguard code
  private collectUsedEnums(interfaceName: string, importPath: string): string[] {
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
      { pattern: 'isNonEmptyArrayWithEachItem', utility: 'isNonEmptyArrayWithEachItem' }
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
    // Match type guard function calls and property values (isXxx followed by parentheses, commas, or used as values)
    const typeGuardPattern = /\bis([A-Z][a-zA-Z0-9_]*)\b(?=\s*[,(]|\s*$|\s*:)/g;
    let match;
    const guardzUtilities = [
      'isString', 'isNumber', 'isBoolean', 'isDate', 'isArrayWithEachItem', 
      'isObjectWithEachItem', 'isUndefinedOr', 'isNullOr', 'isOneOf', 'isOneOfTypes',
      'isEqualTo', 'isAny', 'isUnknown', 'isEnum', 'isNonEmptyString', 
      'isNonNegativeNumber', 'isPositiveNumber', 'isNonEmptyArrayWithEachItem', 'isType'
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
}

// Helper to get the source file of a node
function sourceFileOf(node: ts.Node): ts.SourceFile {
  let current: ts.Node = node;
  while (current.parent) {
    current = current.parent;
  }
  if (ts.isSourceFile(current)) {
    return current;
  }
  throw new Error('Could not find source file for node');
} 