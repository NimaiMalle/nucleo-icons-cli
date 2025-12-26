import { Command } from 'commander';
import chalk from 'chalk';
import { copyFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { getNucleoDb } from '../db/index.js';

export const copyCommand = new Command('copy')
  .description('Copy an icon SVG file to a target directory')
  .argument('<name>', 'Icon name')
  .argument('[destination]', 'Destination directory', './icons')
  .option('-o, --output <filename>', 'Output filename (default: uses icon name)')
  .action((name: string, destination: string, options) => {
    const db = getNucleoDb();

    try {
      const icon = db.getIconByName(name);

      if (!icon) {
        console.log(chalk.red(`Icon "${name}" not found.`));
        console.log(chalk.yellow('\nTry searching first:'));
        console.log(chalk.gray(`  nucleo search "${name}"`));
        return;
      }

      const sourcePath = db.getIconPath(icon);
      if (!existsSync(sourcePath)) {
        console.log(chalk.red(`Icon file not found at ${sourcePath}`));
        return;
      }

      // Prepare destination
      const destDir = resolve(destination);
      const filename = options.output || `${icon.name}.svg`;
      const destPath = join(destDir, filename);

      // Create directory if it doesn't exist
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
        console.log(chalk.gray(`Created directory: ${destDir}`));
      }

      // Copy file
      copyFileSync(sourcePath, destPath);

      console.log(chalk.green('✓ Icon copied successfully!'));
      console.log('');
      console.log(chalk.bold(`  ${icon.name}`));
      console.log(`  From: ${chalk.gray(icon.set_title || `Set ${icon.set_id}`)}`);
      console.log(`  To: ${chalk.cyan(destPath)}`);

      // Show preview
      const svgContent = readFileSync(destPath, 'utf-8');
      const sizeMatch = svgContent.match(/viewBox="[^"]*"/);
      if (sizeMatch) {
        console.log(`  ViewBox: ${chalk.gray(sizeMatch[0])}`);
      }
    } catch (error) {
      console.error(chalk.red('Error copying icon:'), error);
    } finally {
      db.close();
    }
  });
