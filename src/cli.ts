#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { TypeGuardGenerator } from './generator';
import glob from 'glob';

const program = new Command();

program
  .name('guardz-generator')
  .description('Generate TypeScript type guards from interfaces using guardz')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate type guards from TypeScript files')
  .argument('<files...>', 'TypeScript files containing interfaces (supports globs)')
  .option('-i, --interface <name>', 'Specific interface name to generate guard for')
  .option('-g, --guard-name <name>', 'Custom name for the generated guard function')
  .option('--all', 'Generate guards for all interfaces in the files')
  .action(async (files: string[], options: {
    interface?: string;
    guardName?: string;
    all?: boolean;
  }) => {
    try {
      // Expand globs (if any)
      let filePaths: string[] = [];
      for (const file of files) {
        filePaths.push(...glob.sync(file));
      }
      filePaths = Array.from(new Set(filePaths));

      if (filePaths.length === 0) {
        console.error('Error: No files matched.');
        process.exit(1);
      }

      // Check if all files exist
      for (const filePath of filePaths) {
        if (!fs.existsSync(filePath)) {
          console.error(`Error: File '${filePath}' not found`);
          process.exit(1);
        }
      }

      // Create a single generator instance with all source files for proper type resolution
      console.log(`\n🔍 Processing ${filePaths.length} files with cross-file type resolution...`);
      const generator = new TypeGuardGenerator(filePaths);

      if (options.all) {
        // Generate guards for all interfaces across all files
        const generatedFiles = generator.generateAllTypeGuards({
          guardName: options.guardName
        });

        if (generatedFiles.length === 0) {
          console.log('❌ No interfaces found in any of the files');
          process.exit(1);
        }

        for (const file of generatedFiles) {
          console.log(`Debug: Writing file ${file.fileName} with content length ${file.content.length}`);
          if (file.fileName.includes('isObjectTypes')) {
            console.log(`Debug: isObjectTypes content: ${file.content}`);
          }
          fs.writeFileSync(file.fileName, file.content);
          console.log(`✅ Generated: ${file.fileName}`);
        }
      } else {
        // Generate guard for specific interface
        if (!options.interface) {
          console.error('Error: --interface option is required when not using --all');
          process.exit(1);
        }
        const generatedCode = generator.generateTypeGuard(options.interface, {
          guardName: options.guardName
        });
        const guardName = options.guardName || `is${options.interface}`;
        
        // Find the source file containing the interface to determine output location
        const sourceFile = filePaths.find(file => {
          const content = fs.readFileSync(file, 'utf-8');
          return content.includes(`interface ${options.interface}`);
        });
        
        if (!sourceFile) {
          console.error(`Error: Interface '${options.interface}' not found in any of the source files`);
          process.exit(1);
        }
        
        const outputPath = path.join(path.dirname(sourceFile), `${guardName}.ts`);
        fs.writeFileSync(outputPath, generatedCode);
        console.log(`✅ Generated: ${outputPath}`);
      }
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Watch TypeScript files and regenerate type guards on changes')
  .argument('<files...>', 'TypeScript files to watch (supports globs)')
  .option('--all', 'Generate guards for all interfaces in the files')
  .action(async () => {
    console.log('👀 Watch mode is not implemented yet. Use the generate command instead.');
    process.exit(1);
  });

program.parse(); 