#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { TypeGuardGenerator } from './generator';

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
      const glob = require('glob');
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

      for (const filePath of filePaths) {
        const generator = new TypeGuardGenerator([filePath]);
        const fileDir = path.dirname(filePath);
        const fileName = path.basename(filePath);
        console.log(`\n🔍 Processing ${fileName} ...`);

        if (options.all) {
          // Generate guards for all interfaces in this file
          const generatedFiles = generator.generateAllTypeGuards({
            guardName: options.guardName
          });

          if (generatedFiles.length === 0) {
            console.log('❌ No interfaces found in this file');
            continue;
          }

          for (const file of generatedFiles) {
            const outputPath = path.join(fileDir, file.fileName);
            fs.writeFileSync(outputPath, file.content);
            console.log(`✅ Generated: ${outputPath}`);
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
          const outputPath = path.join(fileDir, `${guardName}.ts`);
          fs.writeFileSync(outputPath, generatedCode);
          console.log(`✅ Generated: ${outputPath}`);
        }
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
  .action(async (files: string[], options: {
    all?: boolean;
  }) => {
    console.log('👀 Watch mode is not implemented yet. Use the generate command instead.');
    process.exit(1);
  });

program.parse(); 