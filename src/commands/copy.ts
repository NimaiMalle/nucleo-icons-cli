import { Command } from 'commander';
import chalk from 'chalk';
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import sharp from 'sharp';
import { getNucleoDb } from '../db/index.js';

export const copyCommand = new Command('copy')
  .description('Copy an icon SVG file to a target directory')
  .argument('<name>', 'Icon name')
  .argument('[destination]', 'Destination directory', './icons')
  .option('-o, --output <filename>', 'Output filename (default: uses icon name)')
  .option('--stdout', 'Output file content to stdout instead of copying to file')
  .option('--png', 'Export as PNG instead of SVG')
  .option('--size <pixels>', 'PNG size in pixels (default: 64)', '64')
  .action(async (name: string, destination: string, options) => {
    const db = getNucleoDb();

    try {
      const icon = db.getIconByName(name);

      if (!icon) {
        // Use stderr for errors when --stdout is used
        const errorOut = options.stdout ? console.error : console.log;
        errorOut(chalk.red(`Icon "${name}" not found.`));
        errorOut(chalk.yellow('\nTry searching first:'));
        errorOut(chalk.gray(`  nucleo search "${name}"`));
        return;
      }

      const sourcePath = db.getIconPath(icon);
      if (!existsSync(sourcePath)) {
        const errorOut = options.stdout ? console.error : console.log;
        errorOut(chalk.red(`Icon file not found at ${sourcePath}`));
        return;
      }

      const svgContent = readFileSync(sourcePath, 'utf-8');

      // Handle PNG export
      if (options.png) {
        const size = parseInt(options.size, 10);
        const pngBuffer = await sharp(Buffer.from(svgContent))
          .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();

        if (options.stdout) {
          process.stdout.write(pngBuffer);
          return;
        }

        // Write PNG to file
        const destDir = resolve(destination);
        const defaultFilename = `${icon.name}.png`;
        const filename = options.output || defaultFilename;
        const destPath = join(destDir, filename);

        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
          console.log(chalk.gray(`Created directory: ${destDir}`));
        }

        writeFileSync(destPath, pngBuffer);

        console.log(chalk.green('✓ Icon exported as PNG successfully!'));
        console.log('');
        console.log(chalk.bold(`  ${icon.name}`));
        console.log(`  From: ${chalk.gray(icon.set_title || `Set ${icon.set_id}`)}`);
        console.log(`  To: ${chalk.cyan(destPath)}`);
        console.log(`  Size: ${chalk.yellow(`${size}x${size}`)} pixels`);
        return;
      }

      // Handle SVG output to stdout
      if (options.stdout) {
        process.stdout.write(svgContent);
        return;
      }

      // Copy SVG to file
      const destDir = resolve(destination);
      const filename = options.output || `${icon.name}.svg`;
      const destPath = join(destDir, filename);

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
        console.log(chalk.gray(`Created directory: ${destDir}`));
      }

      copyFileSync(sourcePath, destPath);

      console.log(chalk.green('✓ Icon copied successfully!'));
      console.log('');
      console.log(chalk.bold(`  ${icon.name}`));
      console.log(`  From: ${chalk.gray(icon.set_title || `Set ${icon.set_id}`)}`);
      console.log(`  To: ${chalk.cyan(destPath)}`);

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
