import * as ts from 'typescript';
import * as path from 'path';
import * as prettier from 'prettier';

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
    this.sourceFiles = this.program
      .getSourceFiles()
      .filter(sf => !sf.isDeclarationFile);
  }

  generateAllTypeGuards(
    options: Partial<TypeGuardOptions> = {}
  ): GeneratedFile[] {
    const interfaces: ts.InterfaceDeclaration[] = [];
    const typeAliases: ts.TypeAliasDeclaration[] = [];

    for (const sourceFile of this.sourceFiles) {
      ts.forEachChild(sourceFile, (node: ts.Node) => {
        if (ts.isInterfaceDeclaration(node) && this.isExported(node)) {
          interfaces.push(node);
        } else if (ts.isTypeAliasDeclaration(node) && this.isExported(node)) {
          typeAliases.push(node);
        }
      });
    }

    const interfaceFiles = interfaces.map(interfaceDecl => {
      const guardName = options.guardName || `is${interfaceDecl.name.text}`;
      // Check if interface has generic parameters
      const hasGenerics =
        interfaceDecl.typeParameters && interfaceDecl.typeParameters.length > 0;
      const typeGuardCode = hasGenerics
        ? this.generateGenericTypeGuardCodeForInterface(
            interfaceDecl,
            guardName
          )
        : this.generateTypeGuardCode(interfaceDecl, guardName);
      const fileName = `${guardName}.ts`;
      // Place the generated file in the same directory as the interface definition
      const outputDir = path.dirname(interfaceDecl.getSourceFile().fileName);
      const importTypes = this.collectReferencedTypes(interfaceDecl);
      const needsTypeGuardFnImport = hasGenerics;
      return {
        fileName: path.join(outputDir, fileName),
        content: this.generateCompleteFile(
          guardName,
          typeGuardCode,
          interfaceDecl.name.text,
          importTypes,
          fileName,
          outputDir,
          needsTypeGuardFnImport
        ),
        interfaceName: interfaceDecl.name.text,
      };
    });

    const typeAliasFiles = typeAliases.map(typeAliasDecl => {
      const guardName = options.guardName || `is${typeAliasDecl.name.text}`;
      const typeGuardCode = this.generateGenericTypeGuardCode(
        typeAliasDecl,
        guardName
      );
      const fileName = `${guardName}.ts`;
      // Place the generated file in the same directory as the type alias definition
      const outputDir = path.dirname(typeAliasDecl.getSourceFile().fileName);
      const importTypes =
        this.collectReferencedTypesFromTypeAlias(typeAliasDecl);
      const needsTypeGuardFnImport = this.needsTypeGuardFn(typeGuardCode);
      return {
        fileName: path.join(outputDir, fileName),
        content: this.generateCompleteFile(
          guardName,
          typeGuardCode,
          typeAliasDecl.name.text,
          importTypes,
          fileName,
          outputDir,
          needsTypeGuardFnImport
        ),
        interfaceName: typeAliasDecl.name.text,
      };
    });

    return [...interfaceFiles, ...typeAliasFiles];
  }

  private findInterfaceWithSourceFile(
    interfaceName: string
  ): [ts.InterfaceDeclaration, ts.SourceFile] | null {
    for (const sourceFile of this.sourceFiles) {
      let found: ts.InterfaceDeclaration | null = null;
      ts.forEachChild(sourceFile, (node: ts.Node) => {
        if (
          ts.isInterfaceDeclaration(node) &&
          node.name.text === interfaceName &&
          this.isExported(node) &&
          !found
        ) {
          found = node;
        }
      });
      if (found) {
        return [found, sourceFile];
      }
    }
    return null;
  }

  private findTypeAliasWithSourceFile(
    typeName: string
  ): [ts.TypeAliasDeclaration, ts.SourceFile] | null {
    for (const sourceFile of this.sourceFiles) {
      let found: ts.TypeAliasDeclaration | null = null;
      ts.forEachChild(sourceFile, (node: ts.Node) => {
        if (
          ts.isTypeAliasDeclaration(node) &&
          node.name.text === typeName &&
          this.isExported(node) &&
          !found
        ) {
          found = node;
        }
      });
      if (found) {
        return [found, sourceFile];
      }
    }
    return null;
  }

  generateTypeGuard(
    typeName: string,
    options: Partial<TypeGuardOptions> = {}
  ): string {
    // First try to find as interface
    const interfaceFound = this.findInterfaceWithSourceFile(typeName);
    if (interfaceFound) {
      const [targetInterface] = interfaceFound;
      const guardName = options.guardName || `is${typeName}`;
      const typeGuardCode = this.generateTypeGuardCode(
        targetInterface,
        guardName
      );
      const importTypes = this.collectReferencedTypes(targetInterface);
      const outputDir = path.dirname(targetInterface.getSourceFile().fileName);
      const fileName = `${guardName}.ts`;
      return this.generateCompleteFile(
        guardName,
        typeGuardCode,
        typeName,
        importTypes,
        fileName,
        outputDir
      );
    }

    // Then try to find as type alias
    const typeAliasFound = this.findTypeAliasWithSourceFile(typeName);
    if (typeAliasFound) {
      const [targetTypeAlias] = typeAliasFound;
      const guardName = options.guardName || `is${typeName}`;
      const typeGuardCode = this.generateGenericTypeGuardCode(
        targetTypeAlias,
        guardName
      );
      const importTypes =
        this.collectReferencedTypesFromTypeAlias(targetTypeAlias);
      const outputDir = path.dirname(targetTypeAlias.getSourceFile().fileName);
      const fileName = `${guardName}.ts`;
      return this.generateCompleteFile(
        guardName,
        typeGuardCode,
        typeName,
        importTypes,
        fileName,
        outputDir
      );
    }

    throw new Error(`Type '${typeName}' not found in source files`);
  }

  async writeTypeGuardsToFiles(
    generatedFiles: GeneratedFile[],
    outputDir: string
  ): Promise<void> {
    for (const file of generatedFiles) {
      const fs = (await import('fs')).promises;
      const outPath = path.join(outputDir, file.fileName);
      let formattedContent = file.content;
      try {
        formattedContent = await prettier.format(file.content, {
          parser: 'typescript',
        });
      } catch (e: unknown) {
        // If formatting fails, fallback to unformatted content
        console.warn(
          `Prettier formatting failed for ${file.fileName}:`,
          (e as Error).message
        );
      }
      await fs.writeFile(outPath, formattedContent, 'utf8');
    }
  }

  private generateTypeGuardCode(
    interfaceDecl: ts.InterfaceDeclaration,
    guardName: string
  ): string {
    // Check if this interface has only index signatures (like [k: string]: unknown)
    if (this.hasOnlyIndexSignatures(interfaceDecl)) {
      const indexSignatureType = this.extractIndexSignatureType(interfaceDecl);
      if (indexSignatureType) {
        const valueTypeGuard = this.convertTypeToGuard(indexSignatureType);
        return `export const ${guardName} = isObjectWithEachItem(${valueTypeGuard});`;
      }
    }

    const properties = this.extractProperties(interfaceDecl);

    // Check if this interface is recursive (references itself)
    const isRecursive = this.isRecursiveType(interfaceDecl);

    const propertyGuards = properties
      .map(prop => this.generatePropertyGuard(prop))
      .join(', ');

    if (isRecursive) {
      // For recursive types, use function declaration to avoid "used before defined" error
      return `export function ${guardName}(value: unknown): value is ${interfaceDecl.name.text} {\n  return isType<${interfaceDecl.name.text}>({ ${propertyGuards} })(value);\n}`;
    } else {
      // For non-recursive types, use const assignment
      return `export const ${guardName} = isType<${interfaceDecl.name.text}>({ ${propertyGuards} });`;
    }
  }

  private generateGenericTypeGuardCode(
    typeAliasDecl: ts.TypeAliasDeclaration,
    guardName: string
  ): string {
    const typeParameters = this.extractTypeParameters(typeAliasDecl);

    if (typeParameters.length === 0) {
      // Non-generic type alias, treat like interface
      if (ts.isTypeLiteralNode(typeAliasDecl.type)) {
        const properties = this.extractPropertiesFromTypeLiteral(
          typeAliasDecl.type
        );
        const propertyGuards = properties
          .map(prop => this.generatePropertyGuard(prop))
          .join(', ');
        return `export const ${guardName} = isType<${typeAliasDecl.name.text}>({ ${propertyGuards} });`;
      } else {
        // Simple type alias like: type MyString = string
        const typeGuard = this.convertTypeToGuard(typeAliasDecl.type);
        return `export const ${guardName} = ${typeGuard};`;
      }
    } else {
      // Generic type alias
      const typeParameterNames = typeParameters.map(tp => tp.name);
      const formattedTypeParameters = typeParameters.map(tp =>
        this.formatTypeParameter(tp)
      );
      const typeGuardParams = typeParameters.map(
        tp => `typeGuard${tp.name}: TypeGuardFn<${tp.name}>`
      );
      const genericTypeString = `${typeAliasDecl.name.text}<${typeParameterNames.join(', ')}>`;

      if (ts.isTypeLiteralNode(typeAliasDecl.type)) {
        const properties = this.extractPropertiesFromTypeLiteral(
          typeAliasDecl.type
        );
        const propertyGuards = properties
          .map(prop =>
            this.generatePropertyGuardForGeneric(prop, typeParameterNames)
          )
          .join(', ');

        return `export const ${guardName} = <${formattedTypeParameters.join(', ')}>(${typeGuardParams.join(', ')}) => isType<${genericTypeString}>({ ${propertyGuards} });`;
      } else {
        // Simple generic type alias
        const typeGuard = this.convertTypeToGuardForGeneric(
          typeAliasDecl.type,
          typeParameterNames
        );
        return `export const ${guardName} = <${formattedTypeParameters.join(', ')}>(${typeGuardParams.join(', ')}) => ${typeGuard};`;
      }
    }
  }

  private generateGenericTypeGuardCodeForInterface(
    interfaceDecl: ts.InterfaceDeclaration,
    guardName: string
  ): string {
    const typeParameters =
      this.extractTypeParametersFromInterface(interfaceDecl);

    if (typeParameters.length === 0) {
      // Non-generic interface, use regular generation
      return this.generateTypeGuardCode(interfaceDecl, guardName);
    } else {
      // Generic interface
      const typeParameterNames = typeParameters.map(
        (tp: {
          name: string;
          constraint?: ts.TypeNode;
          default?: ts.TypeNode;
        }) => tp.name
      );
      const formattedTypeParameters = typeParameters.map(
        (tp: {
          name: string;
          constraint?: ts.TypeNode;
          default?: ts.TypeNode;
        }) => this.formatTypeParameter(tp)
      );
      const typeGuardParams = typeParameters.map(
        (tp: {
          name: string;
          constraint?: ts.TypeNode;
          default?: ts.TypeNode;
        }) => `typeGuard${tp.name}: TypeGuardFn<${tp.name}>`
      );
      const genericTypeString = `${interfaceDecl.name.text}<${typeParameterNames.join(', ')}>`;

      const properties = this.extractProperties(interfaceDecl);
      const propertyGuards = properties
        .map(prop =>
          this.generatePropertyGuardForGeneric(prop, typeParameterNames)
        )
        .join(', ');

      return `export const ${guardName} = <${formattedTypeParameters.join(', ')}>(${typeGuardParams.join(', ')}) => isType<${genericTypeString}>({ ${propertyGuards} });`;
    }
  }

  // Check if an interface is recursive (references itself)
  private isRecursiveType(interfaceDecl: ts.InterfaceDeclaration): boolean {
    const interfaceName = interfaceDecl.name.text;

    // Check if any property references the same interface
    const properties = this.extractProperties(interfaceDecl);
    for (const property of properties) {
      if (this.typeReferencesInterface(property.type, interfaceName)) {
        return true;
      }
    }

    return false;
  }

  // Check if a type node references the given interface name
  private typeReferencesInterface(
    typeNode: ts.TypeNode,
    interfaceName: string
  ): boolean {
    if (ts.isTypeReferenceNode(typeNode)) {
      const typeName = typeNode.typeName.getText();
      return typeName === interfaceName;
    } else if (ts.isArrayTypeNode(typeNode)) {
      return this.typeReferencesInterface(typeNode.elementType, interfaceName);
    } else if (ts.isUnionTypeNode(typeNode)) {
      return typeNode.types.some(type =>
        this.typeReferencesInterface(type, interfaceName)
      );
    } else if (ts.isParenthesizedTypeNode(typeNode)) {
      return this.typeReferencesInterface(typeNode.type, interfaceName);
    }

    return false;
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

  // Check if interface has only index signatures (like [k: string]: unknown)
  private hasOnlyIndexSignatures(
    interfaceDecl: ts.InterfaceDeclaration
  ): boolean {
    const hasIndexSignature = interfaceDecl.members.some(member =>
      ts.isIndexSignatureDeclaration(member)
    );
    const hasPropertySignature = interfaceDecl.members.some(member =>
      ts.isPropertySignature(member)
    );
    return hasIndexSignature && !hasPropertySignature;
  }

  // Extract index signature type for Record-like interfaces
  private extractIndexSignatureType(
    interfaceDecl: ts.InterfaceDeclaration
  ): ts.TypeNode | null {
    for (const member of interfaceDecl.members) {
      if (ts.isIndexSignatureDeclaration(member)) {
        return member.type || null;
      }
    }
    return null;
  }

  private extractPropertiesFromTypeLiteral(
    typeLiteral: ts.TypeLiteralNode
  ): Array<{
    name: string;
    type: ts.TypeNode;
    isOptional: boolean;
  }> {
    const properties: Array<{
      name: string;
      type: ts.TypeNode;
      isOptional: boolean;
    }> = [];
    typeLiteral.members.forEach((member: ts.TypeElement) => {
      // Skip index signatures like [k: string]: unknown
      if (ts.isIndexSignatureDeclaration(member)) {
        return;
      }
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

  private extractTypeParameters(typeAliasDecl: ts.TypeAliasDeclaration): Array<{
    name: string;
    constraint?: ts.TypeNode;
    default?: ts.TypeNode;
  }> {
    const typeParameters: Array<{
      name: string;
      constraint?: ts.TypeNode;
      default?: ts.TypeNode;
    }> = [];

    if (typeAliasDecl.typeParameters) {
      typeAliasDecl.typeParameters.forEach(
        (typeParam: ts.TypeParameterDeclaration) => {
          typeParameters.push({
            name: typeParam.name.text,
            constraint: typeParam.constraint,
            default: typeParam.default,
          });
        }
      );
    }

    return typeParameters;
  }

  private extractTypeParametersFromInterface(
    interfaceDecl: ts.InterfaceDeclaration
  ): Array<{
    name: string;
    constraint?: ts.TypeNode;
    default?: ts.TypeNode;
  }> {
    const typeParameters: Array<{
      name: string;
      constraint?: ts.TypeNode;
      default?: ts.TypeNode;
    }> = [];

    if (interfaceDecl.typeParameters) {
      interfaceDecl.typeParameters.forEach(
        (typeParam: ts.TypeParameterDeclaration) => {
          typeParameters.push({
            name: typeParam.name.text,
            constraint: typeParam.constraint,
            default: typeParam.default,
          });
        }
      );
    }

    return typeParameters;
  }

  private formatTypeParameter(typeParam: {
    name: string;
    constraint?: ts.TypeNode;
    default?: ts.TypeNode;
  }): string {
    let result = typeParam.name;

    if (typeParam.constraint) {
      const constraintText = typeParam.constraint.getText();
      result += ` extends ${constraintText}`;
    }

    if (typeParam.default) {
      const defaultText = typeParam.default.getText();
      result += ` = ${defaultText}`;
    }

    return result;
  }

  private generatePropertyGuard(
    property: {
      name: string;
      type: ts.TypeNode;
      isOptional: boolean;
    },
    typeParameterNames?: string[]
  ): string {
    const typeGuard = this.convertTypeToGuard(
      property.type,
      typeParameterNames
    );
    console.log(
      `Debug: Property ${property.name} generated guard: ${typeGuard}`
    );
    if (property.isOptional) {
      return `${property.name}: isUndefinedOr(${typeGuard})`;
    } else {
      return `${property.name}: ${typeGuard}`;
    }
  }

  private generatePropertyGuardForGeneric(
    property: {
      name: string;
      type: ts.TypeNode;
      isOptional: boolean;
    },
    typeParameterNames: string[]
  ): string {
    const typeGuard = this.convertTypeToGuardForGeneric(
      property.type,
      typeParameterNames
    );
    console.log(
      `Debug: Property ${property.name} generated generic guard: ${typeGuard}`
    );
    if (property.isOptional) {
      return `${property.name}: isUndefinedOr(${typeGuard})`;
    } else {
      return `${property.name}: ${typeGuard}`;
    }
  }

  private convertTypeToGuard(
    typeNode: ts.TypeNode,
    typeParameterNames?: string[]
  ): string {
    if (ts.isUnionTypeNode(typeNode)) {
      return this.handleUnionType(typeNode, typeParameterNames);
    } else if (ts.isTypeReferenceNode(typeNode)) {
      return typeParameterNames
        ? this.handleTypeReferenceForGeneric(typeNode, typeParameterNames)
        : this.handleTypeReference(typeNode);
    } else if (ts.isTypeLiteralNode(typeNode)) {
      return typeParameterNames
        ? this.handleTypeLiteralForGeneric(typeNode, typeParameterNames)
        : this.handleTypeLiteral(typeNode);
    } else if (ts.isArrayTypeNode(typeNode)) {
      return typeParameterNames
        ? this.handleArrayTypeForGeneric(typeNode, typeParameterNames)
        : this.handleArrayType(typeNode);
    } else if (ts.isLiteralTypeNode(typeNode)) {
      return this.handleLiteralType(typeNode);
    } else {
      return this.handlePrimitiveType(typeNode);
    }
  }

  private convertTypeToGuardForGeneric(
    typeNode: ts.TypeNode,
    typeParameterNames: string[]
  ): string {
    if (ts.isUnionTypeNode(typeNode)) {
      return this.handleUnionTypeForGeneric(typeNode, typeParameterNames);
    } else if (ts.isTypeReferenceNode(typeNode)) {
      return this.handleTypeReferenceForGeneric(typeNode, typeParameterNames);
    } else if (ts.isTypeLiteralNode(typeNode)) {
      return this.handleTypeLiteralForGeneric(typeNode, typeParameterNames);
    } else if (ts.isArrayTypeNode(typeNode)) {
      return this.handleArrayTypeForGeneric(typeNode, typeParameterNames);
    } else if (ts.isLiteralTypeNode(typeNode)) {
      return this.handleLiteralType(typeNode);
    } else {
      return this.handlePrimitiveType(typeNode);
    }
  }

  private handleUnionType(
    unionType: ts.UnionTypeNode,
    typeParameterNames?: string[]
  ): string {
    const types = unionType.types;
    const typeText = unionType.getText();
    console.log(`Debug: handleUnionType called with type: ${typeText}`);
    console.log(`Debug: Number of types in union: ${types.length}`);

    if (types.length === 2) {
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
    const allLiterals = types.every(
      (type: ts.TypeNode) =>
        ts.isLiteralTypeNode(type) &&
        (type.literal.kind === ts.SyntaxKind.StringLiteral ||
          type.literal.kind === ts.SyntaxKind.NumericLiteral ||
          type.literal.kind === ts.SyntaxKind.BooleanKeyword)
    );

    if (allLiterals) {
      // For literal unions like 'a' | 'b' | 'c', use isOneOf with values
      const literalValues = types
        .map((type: ts.TypeNode) => {
          if (ts.isLiteralTypeNode(type)) {
            return type.literal.getText();
          }
          return '';
        })
        .filter(Boolean);
      return `isOneOf(${literalValues.join(', ')})`;
    }

    // Check for union with null or undefined
    const hasNull = types.some(
      type =>
        ts.isLiteralTypeNode(type) &&
        type.literal.kind === ts.SyntaxKind.NullKeyword
    );
    const hasUndefined = types.some(
      type =>
        ts.isLiteralTypeNode(type) &&
        type.literal.kind === ts.SyntaxKind.UndefinedKeyword
    );

    if (hasNull || hasUndefined) {
      // Handle cases like ('ltr' | 'rtl') | null or string | null
      const nonNullTypes = types.filter(
        type =>
          !(
            ts.isLiteralTypeNode(type) &&
            (type.literal.kind === ts.SyntaxKind.NullKeyword ||
              type.literal.kind === ts.SyntaxKind.UndefinedKeyword)
          )
      );

      if (nonNullTypes.length === 1) {
        // Single non-null type, like ('ltr' | 'rtl') | null
        let nonNullType = nonNullTypes[0];
        // Unwrap ParenthesizedTypeNode if present
        if (ts.isParenthesizedTypeNode(nonNullType)) {
          nonNullType = nonNullType.type;
        }
        // Check if the non-null type is itself a union of literals
        if (ts.isUnionTypeNode(nonNullType)) {
          const literalUnion = this.handleUnionType(
            nonNullType,
            typeParameterNames
          );
          return hasNull
            ? `isNullOr(${literalUnion})`
            : `isUndefinedOr(${literalUnion})`;
        }
        // Single type like string | null
        const guard = typeParameterNames
          ? this.convertTypeToGuardForGeneric(nonNullType, typeParameterNames)
          : this.convertTypeToGuard(nonNullType);
        return hasNull ? `isNullOr(${guard})` : `isUndefinedOr(${guard})`;
      }
    }

    // For type unions like string | number | boolean, use isOneOfTypes
    // 1. Extract type names and their corresponding guard expressions
    const typePairs = types.map((type: ts.TypeNode) => {
      // Unwrap ParenthesizedTypeNode if present
      let actualType = type;
      if (ts.isParenthesizedTypeNode(actualType)) {
        actualType = actualType.type;
      }
      let typeName = actualType.getText();
      let guard: string;

      // Debug logging for each union member
      console.log(`Debug: Union member typeName: ${typeName}`);
      console.log(`Debug: Union member node kind: ${actualType.kind}`);
      console.log(
        `Debug: Is TypeReferenceNode: ${ts.isTypeReferenceNode(actualType)}`
      );
      console.log(
        `Debug: Is ParenthesizedTypeNode: ${ts.isParenthesizedTypeNode(actualType)}`
      );
      console.log(`Debug: Is UnionTypeNode: ${ts.isUnionTypeNode(actualType)}`);

      if (ts.isTypeReferenceNode(actualType)) {
        // Use appropriate type reference handler based on whether we have type parameters
        if (typeParameterNames && typeParameterNames.includes(typeName)) {
          guard = `typeGuard${typeName}`;
          console.log(`Debug: Generic type parameter guard: ${guard}`);
        } else {
          guard = typeParameterNames
            ? this.handleTypeReferenceForGeneric(actualType, typeParameterNames)
            : this.handleTypeReference(actualType);
          console.log(`Debug: TypeReferenceNode guard: ${guard}`);
        }
      } else if (this.isInterfaceType(typeName)) {
        // Fallback: if typeName matches a known interface, use its type guard
        guard = `is${typeName}`;
        console.log(`Debug: Interface fallback guard: ${guard}`);
      } else {
        guard = typeParameterNames
          ? this.convertTypeToGuardForGeneric(actualType, typeParameterNames)
          : this.convertTypeToGuard(actualType);
        console.log(`Debug: Default guard: ${guard}`);
      }

      console.log(`Debug: Final guard for ${typeName}: ${guard}`);
      return {
        typeName,
        guard,
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
        console.log(
          `Debug: Processing Partial with ${typeRef.typeArguments?.length || 0} type arguments`
        );
        if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
          const arg = typeRef.typeArguments[0];
          console.log(`Debug: Partial argument type: ${arg.getText()}`);
          let innerTypeGuard;
          if (ts.isTypeLiteralNode(arg)) {
            // Inline object type: generate just the object literal, not isType({ ... })
            console.log(`Debug: Partial argument is TypeLiteral`);
            innerTypeGuard = this.handleTypeLiteral(
              arg,
              /*wrapInIsType*/ false
            );
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

  private handleTypeLiteral(
    typeLiteral: ts.TypeLiteralNode,
    wrapInIsType: boolean = true
  ): string {
    const properties = typeLiteral.members
      .map((member: ts.TypeElement) => {
        // Skip index signatures like [k: string]: unknown
        if (ts.isIndexSignatureDeclaration(member)) {
          return '';
        }
        if (ts.isPropertySignature(member) && member.name && member.type) {
          const name = member.name.getText();
          let typeGuard: string;
          // If the type is a type literal, recursively call without indentation
          if (ts.isTypeLiteralNode(member.type)) {
            typeGuard = this.handleTypeLiteral(member.type, true);
          } else {
            typeGuard = this.convertTypeToGuard(member.type);
          }
          const isOptional = member.questionToken !== undefined;
          if (isOptional) {
            return `${name}: isUndefinedOr(${typeGuard})`;
          } else {
            return `${name}: ${typeGuard}`;
          }
        }
        return '';
      })
      .filter(Boolean);
    const objectLiteral = `{ ${properties.join(', ')} }`;
    return wrapInIsType ? `isType(${objectLiteral})` : objectLiteral;
  }

  private handleArrayType(arrayType: ts.ArrayTypeNode): string {
    // If the element type is a union, generate isArrayWithEachItem(isOneOfTypes<...>(...))
    let elementType = arrayType.elementType;

    // Unwrap ParenthesizedTypeNode if present
    if (ts.isParenthesizedTypeNode(elementType)) {
      elementType = elementType.type;
    }

    if (ts.isUnionTypeNode(elementType)) {
      // For union types, use handleUnionType to get the correct guard
      const unionGuard = this.handleUnionType(elementType);
      return `isArrayWithEachItem(${unionGuard})`;
    }
    // Otherwise, use the regular element type guard
    const elementGuard = this.convertTypeToGuard(elementType);
    return `isArrayWithEachItem(${elementGuard})`;
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

  private handleUnionTypeForGeneric(
    unionType: ts.UnionTypeNode,
    typeParameterNames: string[]
  ): string {
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

    // For type unions like string | number | boolean, use isOneOfTypes
    const typePairs = types.map((type: ts.TypeNode) => {
      const typeName = type.getText();
      return {
        typeName,
        guard: this.convertTypeToGuardForGeneric(type, typeParameterNames),
      };
    });
    typePairs.sort((a, b) => a.typeName.localeCompare(b.typeName));
    const genericType = typePairs.map(pair => pair.typeName).join(' | ');
    const guardArgs = typePairs.map(pair => pair.guard).join(', ');
    return `isOneOfTypes<${genericType}>(${guardArgs})`;
  }

  private handleTypeReferenceForGeneric(
    typeRef: ts.TypeReferenceNode,
    typeParameterNames: string[]
  ): string {
    const typeName = typeRef.typeName.getText();

    // Check if this is a generic type parameter
    if (typeParameterNames.includes(typeName)) {
      return `typeGuard${typeName}`;
    }

    // Check if this is an interface that has a corresponding type guard
    if (this.isInterfaceType(typeName)) {
      return `is${typeName}(typeGuardT)`;
    }

    // Otherwise, use regular type reference handling
    return this.handleTypeReference(typeRef);
  }

  private handleTypeLiteralForGeneric(
    typeLiteral: ts.TypeLiteralNode,
    typeParameterNames: string[]
  ): string {
    const properties = typeLiteral.members
      .map((member: ts.TypeElement) => {
        // Skip index signatures like [k: string]: unknown
        if (ts.isIndexSignatureDeclaration(member)) {
          return '';
        }
        if (ts.isPropertySignature(member) && member.name && member.type) {
          const name = member.name.getText();
          let typeGuard: string;
          if (ts.isTypeLiteralNode(member.type)) {
            typeGuard = this.handleTypeLiteralForGeneric(
              member.type,
              typeParameterNames
            );
          } else {
            typeGuard = this.convertTypeToGuardForGeneric(
              member.type,
              typeParameterNames
            );
          }
          const isOptional = member.questionToken !== undefined;
          if (isOptional) {
            return `${name}: isUndefinedOr(${typeGuard})`;
          } else {
            return `${name}: ${typeGuard}`;
          }
        }
        return '';
      })
      .filter(Boolean);
    const objectLiteral = `{ ${properties.join(', ')} }`;
    return `isType(${objectLiteral})`;
  }

  private handleArrayTypeForGeneric(
    arrayType: ts.ArrayTypeNode,
    typeParameterNames: string[]
  ): string {
    const elementType = this.convertTypeToGuardForGeneric(
      arrayType.elementType,
      typeParameterNames
    );
    return `isArrayWithEachItem(${elementType})`;
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
  private collectReferencedTypes(
    interfaceDecl: ts.InterfaceDeclaration
  ): string[] {
    const referenced = new Set<string>();
    referenced.add(interfaceDecl.name.text);

    const visit = (typeNode: ts.TypeNode | undefined) => {
      if (!typeNode) return;
      if (ts.isTypeReferenceNode(typeNode)) {
        const typeName = typeNode.typeName.getText();
        // Don't add enums to type imports since they're used at runtime
        // Don't add built-in types that don't need imports
        if (
          !this.isEnumType(typeName) &&
          !this.isBuiltInType(typeName) &&
          !this.isTypeAlias(typeName)
        ) {
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
      } else if (ts.isParenthesizedTypeNode(typeNode)) {
        visit(typeNode.type);
      }
    };

    interfaceDecl.members.forEach((member: ts.TypeElement) => {
      if (ts.isPropertySignature(member) && member.type) {
        visit(member.type);
      }
    });

    return Array.from(referenced);
  }

  // Collect all referenced types/interfaces/enums for import from type alias
  private collectReferencedTypesFromTypeAlias(
    typeAliasDecl: ts.TypeAliasDeclaration
  ): string[] {
    const referenced = new Set<string>();
    referenced.add(typeAliasDecl.name.text);

    const visit = (typeNode: ts.TypeNode | undefined) => {
      if (!typeNode) return;
      if (ts.isTypeReferenceNode(typeNode)) {
        const typeName = typeNode.typeName.getText();
        // Don't add enums to type imports since they're used at runtime
        // Don't add built-in types that don't need imports
        if (
          !this.isEnumType(typeName) &&
          !this.isBuiltInType(typeName) &&
          !this.isTypeAlias(typeName)
        ) {
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

    visit(typeAliasDecl.type);

    return Array.from(referenced);
  }

  // Check if a type is a built-in type that doesn't need imports
  private isBuiltInType(typeName: string): boolean {
    const builtInTypes = [
      'string',
      'number',
      'boolean',
      'any',
      'unknown',
      'null',
      'undefined',
      'Date',
      'Array',
      'Promise',
      'Map',
      'Set',
      'RegExp',
      'Error',
      'Object',
      'Function',
      'Symbol',
      'BigInt',
      'Partial',
    ];
    return builtInTypes.includes(typeName);
  }

  // Check if a type is a type alias that doesn't need imports
  private isTypeAlias(typeName: string): boolean {
    const typeAliases = [
      'Nullable',
      'NonEmptyString',
      'NonNegativeNumber',
      'PositiveNumber',
      'NonEmptyArray',
    ];
    return typeAliases.includes(typeName);
  }

  private generateCompleteFile(
    guardName: string,
    typeGuardCode: string,
    interfaceName: string,
    importTypes: string[],
    fileName: string,
    outputDir: string,
    needsTypeGuardFnImport?: boolean
  ): string {
    // Collect enums used in the generated type guard code
    const usedEnumsInCode = this.collectUsedEnumsInCode(typeGuardCode);

    // Collect guardz utilities used in the generated code
    const usedGuardzUtilities = this.collectUsedGuardzUtilities(typeGuardCode);

    // Collect type guard functions used in the generated code
    const usedTypeGuards = this.collectUsedTypeGuards(typeGuardCode);

    // Only import types that are actually referenced in the generated code
    const usedTypes = importTypes.filter(type =>
      new RegExp(`\\b${type}\\b`).test(typeGuardCode)
    );

    // For each used type, resolve its source file and compute the relative import path
    const typeImportsArr: string[] = [];
    const enumImportsArr: string[] = [];
    for (const type of usedTypes) {
      const typeSourceFile = findTypeSourceFile(type, this.sourceFiles);
      if (typeSourceFile) {
        const relPath =
          './' +
          path
            .relative(outputDir, typeSourceFile)
            .replace(/\\/g, '/')
            .replace(/\.ts$/, '');
        // Check if it's an enum
        if (this.isEnumType(type)) {
          enumImportsArr.push(`import { ${type} } from '${relPath}';`);
        } else {
          typeImportsArr.push(`import type { ${type} } from '${relPath}';`);
        }
      }
    }

    // Add imports for guardz type aliases used in the generated code
    const usedGuardzTypeAliases =
      this.collectUsedGuardzTypeAliases(typeGuardCode);
    for (const type of usedGuardzTypeAliases) {
      typeImportsArr.push(`import type { ${type} } from 'guardz';`);
    }

    // Add TypeGuardFn import if needed for generic type guards
    if (needsTypeGuardFnImport || this.needsTypeGuardFn(typeGuardCode)) {
      typeImportsArr.push(`import type { TypeGuardFn } from 'guardz';`);
    }

    // Add imports for enums used in the generated code
    for (const enumName of usedEnumsInCode) {
      const enumSourceFile = findTypeSourceFile(enumName, this.sourceFiles);
      if (enumSourceFile) {
        const relPath =
          './' +
          path
            .relative(outputDir, enumSourceFile)
            .replace(/\\/g, '/')
            .replace(/\.ts$/, '');
        enumImportsArr.push(`import { ${enumName} } from '${relPath}';`);
      }
    }
    const typeImports = typeImportsArr.join('\n');
    const enumImports = enumImportsArr.join('\n');
    const guardzImports =
      usedGuardzUtilities.length > 0
        ? `import { ${usedGuardzUtilities.join(', ')} } from 'guardz';`
        : '';
    // Filter out the current type guard to avoid circular imports
    const filteredTypeGuards = usedTypeGuards.filter(
      name =>
        name !== guardName && new RegExp(`\\b${name}\\b`).test(typeGuardCode)
    );
    // Import type guards from their individual files (relative to outputDir)
    const typeGuardImports = filteredTypeGuards
      .map(name => {
        // Find the actual source file for this type guard
        const typeGuardSourceFile = this.findTypeGuardSourceFile(name);
        if (typeGuardSourceFile) {
          const relPath =
            './' +
            path
              .relative(outputDir, typeGuardSourceFile)
              .replace(/\\/g, '/')
              .replace(/\.ts$/, '');
          return `import { ${name} } from '${relPath}';`;
        }
        // Fallback to same directory if not found
        const guardFile = `${name}.ts`;
        const relPath =
          './' +
          path
            .relative(outputDir, path.join(outputDir, guardFile))
            .replace(/\\/g, '/')
            .replace(/\.ts$/, '');
        return `import { ${name} } from '${relPath}';`;
      })
      .join('\n');
    const allImports = [
      typeImports,
      enumImports,
      guardzImports,
      typeGuardImports,
    ].filter(Boolean);
    const importsSection = allImports.join('\n');

    return `${importsSection}${importsSection ? '\n\n' : ''}${typeGuardCode}\n`;
  }

  // Collect enums used in the generated typeguard code
  private collectUsedEnums(interfaceName: string): string[] {
    const usedEnums = new Set<string>();

    // Find the interface and check its properties for enum usage
    for (const sourceFile of this.sourceFiles) {
      ts.forEachChild(sourceFile, (node: ts.Node) => {
        if (
          ts.isInterfaceDeclaration(node) &&
          node.name.text === interfaceName
        ) {
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

    // Check for specific utilities in the generated code using word boundaries
    const utilityChecks = [
      { pattern: /\bisType\b/, utility: 'isType' },
      { pattern: /\bisString\b/, utility: 'isString' },
      { pattern: /\bisNumber\b/, utility: 'isNumber' },
      { pattern: /\bisBoolean\b/, utility: 'isBoolean' },
      { pattern: /\bisDate\b/, utility: 'isDate' },
      { pattern: /\bisArrayWithEachItem\b/, utility: 'isArrayWithEachItem' },
      { pattern: /\bisObjectWithEachItem\b/, utility: 'isObjectWithEachItem' },
      { pattern: /\bisUndefinedOr\b/, utility: 'isUndefinedOr' },
      { pattern: /\bisNullOr\b/, utility: 'isNullOr' },
      { pattern: /\bisOneOf\b/, utility: 'isOneOf' },
      { pattern: /\bisOneOfTypes\b/, utility: 'isOneOfTypes' },
      { pattern: /\bisEqualTo\b/, utility: 'isEqualTo' },
      { pattern: /\bisAny\b/, utility: 'isAny' },
      { pattern: /\bisUnknown\b/, utility: 'isUnknown' },
      { pattern: /\bisEnum\b/, utility: 'isEnum' },
      { pattern: /\bisNonEmptyString\b/, utility: 'isNonEmptyString' },
      { pattern: /\bisNonNegativeNumber\b/, utility: 'isNonNegativeNumber' },
      { pattern: /\bisPositiveNumber\b/, utility: 'isPositiveNumber' },
      {
        pattern: /\bisNonEmptyArrayWithEachItem\b/,
        utility: 'isNonEmptyArrayWithEachItem',
      },
      { pattern: /\bisPartialOf\b/, utility: 'isPartialOf' },
    ];

    for (const check of utilityChecks) {
      if (check.pattern.test(typeGuardCode)) {
        usedUtilities.add(check.utility);
      }
    }

    return Array.from(usedUtilities).sort();
  }

  // Collect type guard functions used in the generated typeguard code
  private collectUsedTypeGuards(typeGuardCode: string): string[] {
    const usedTypeGuards = new Set<string>();
    // Match type guard function calls (isXxx followed by parentheses, commas, closing braces, or used as arguments)
    // More specific pattern: match isXxx when it's a function call, argument, or at end of object literal
    const typeGuardPattern =
      /\bis([A-Z][a-zA-Z0-9_]*)\b(?=\s*\(|\s*,|\s*\)|\s*})/g;
    let match;
    const guardzUtilities = [
      'isString',
      'isNumber',
      'isBoolean',
      'isDate',
      'isArrayWithEachItem',
      'isObjectWithEachItem',
      'isUndefinedOr',
      'isNullOr',
      'isOneOf',
      'isOneOfTypes',
      'isEqualTo',
      'isAny',
      'isUnknown',
      'isEnum',
      'isNonEmptyString',
      'isNonNegativeNumber',
      'isPositiveNumber',
      'isNonEmptyArrayWithEachItem',
      'isType',
      'isPartialOf',
    ];
    while ((match = typeGuardPattern.exec(typeGuardCode)) !== null) {
      const typeGuardName = match[0];
      if (!guardzUtilities.includes(typeGuardName)) {
        usedTypeGuards.add(typeGuardName);
      }
    }
    return Array.from(usedTypeGuards).sort();
  }

  // Collect guardz type aliases used in the generated typeguard code
  private collectUsedGuardzTypeAliases(typeGuardCode: string): string[] {
    // These are the guardz type aliases that should be imported if used
    const guardzTypeAliases = [
      'NonEmptyArray',
      'NonEmptyString',
      'NonNegativeNumber',
      'PositiveNumber',
      'Nullable',
    ];
    const usedAliases = new Set<string>();
    // Look for usages like NonEmptyArray<, NonEmptyString<, etc.
    for (const alias of guardzTypeAliases) {
      const pattern = new RegExp(`\\b${alias}\\b`, 'g');
      if (pattern.test(typeGuardCode)) {
        usedAliases.add(alias);
      }
    }
    return Array.from(usedAliases).sort();
  }

  // Check if TypeGuardFn is needed in the generated code
  private needsTypeGuardFn(typeGuardCode: string): boolean {
    return typeGuardCode.includes('TypeGuardFn<');
  }

  // Check if a declaration is exported
  private isExported(
    node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration
  ): boolean {
    // Check if the node has export modifier
    return (
      node.modifiers?.some(
        modifier => modifier.kind === ts.SyntaxKind.ExportKeyword
      ) ?? false
    );
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
        if (
          ts.isInterfaceDeclaration(node) &&
          node.name.text === interfaceName
        ) {
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
function findTypeSourceFile(
  typeName: string,
  sourceFiles: ts.SourceFile[]
): string | undefined {
  for (const sf of sourceFiles) {
    let found = false;
    ts.forEachChild(sf, (node: ts.Node) => {
      if (
        (ts.isInterfaceDeclaration(node) ||
          ts.isEnumDeclaration(node) ||
          ts.isTypeAliasDeclaration(node)) &&
        node.name &&
        node.name.text === typeName
      ) {
        found = true;
      }
    });
    if (found) return sf.fileName;
  }
  return undefined;
}
