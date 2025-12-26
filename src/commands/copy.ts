import { Command } from 'commander';
import chalk from 'chalk';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import sharp from 'sharp';
import { getNucleoDb, Icon } from '../db/index.js';

/**
 * Replace colors in SVG content
 * Handles both stroke and fill attributes, preserving opacity for duotone
 */
function replaceColors(svg: string, primaryColor?: string, secondaryColor?: string): string {
  let result = svg;

  if (primaryColor) {
    // Common primary colors in Nucleo icons
    const primaryColors = ['#212121', '#000', '#000000'];

    for (const color of primaryColors) {
      // Replace stroke colors (without opacity = primary)
      // Match stroke="color" NOT followed by stroke-opacity
      result = result.replace(
        new RegExp(`stroke="${color}"(?![^>]*stroke-opacity)`, 'gi'),
        `stroke="${primaryColor}"`
      );

      // Replace fill colors (without data-color="color-2" = primary)
      // Match fill="color" NOT followed by data-color="color-2"
      result = result.replace(
        new RegExp(`fill="${color}"(?![^>]*data-color="color-2")`, 'gi'),
        `fill="${primaryColor}"`
      );
    }
  }

  if (secondaryColor) {
    // Common primary colors that might have opacity (secondary in duotone)
    const primaryColors = ['#212121', '#000', '#000000'];

    for (const color of primaryColors) {
      // Replace stroke colors WITH opacity (secondary in Arcade duotone)
      result = result.replace(
        new RegExp(`stroke="${color}"([^>]*stroke-opacity="[^"]*")`, 'gi'),
        `stroke="${secondaryColor}" stroke-opacity="1"`
      );

      // Replace fill colors WITH data-color="color-2" (secondary in UI icons)
      result = result.replace(
        new RegExp(`fill="${color}"([^>]*data-color="color-2")`, 'gi'),
        `fill="${secondaryColor}"$1`
      );
    }
  }

  return result;
}

export const copyCommand = new Command('copy')
  .description('Copy an icon SVG file to a target directory')
  .argument('[name]', 'Icon name (required unless using --id)')
  .argument('[destination]', 'Destination directory', './icons')
  .option('-o, --output <filename>', 'Output filename (default: uses icon name)')
  .option('--stdout', 'Output file content to stdout instead of copying to file')
  .option('--png', 'Export as PNG instead of SVG')
  .option('--size <pixels>', 'PNG size in pixels (default: 64)', '64')
  .option('-g, --group <name>', 'Filter by style group (UI, Core, Micro, Arcade, etc.)')
  .option('--id <number>', 'Copy by exact icon ID (from search --expand)')
  .option('-c, --color <color>', 'Replace primary color (e.g., "#ffffff", "currentColor")')
  .option('--secondary <color>', 'Replace secondary/accent color for duotone icons')
  .action(async (name: string | undefined, destination: string, options) => {
    const db = getNucleoDb();
    const errorOut = options.stdout ? console.error : console.log;

    try {
      let icon: Icon | undefined;

      // Handle --id flag
      if (options.id) {
        const id = parseInt(options.id, 10);
        if (isNaN(id)) {
          errorOut(chalk.red(`Invalid icon ID: "${options.id}"`));
          return;
        }
        icon = db.getIconById(id);
        if (!icon) {
          errorOut(chalk.red(`No icon found with ID ${id}`));
          return;
        }
      } else {
        // Require name if not using --id
        if (!name) {
          errorOut(chalk.red('Icon name is required (or use --id)'));
          errorOut(chalk.gray('  nucleo copy "icon-name" ./destination'));
          errorOut(chalk.gray('  nucleo copy --id 315 ./destination'));
          return;
        }

        // Handle --group flag
        let groupId: number | undefined;
        let setId: number | undefined;

        if (options.group) {
          const groups = db.getGroups();
          const group = groups.find(g =>
            g.title.toLowerCase().includes(options.group.toLowerCase())
          );
          if (group) {
            groupId = group.id;
          } else {
            // Check if it's a specialty set (like Arcade)
            const sets = db.getUngroupedSets();
            const set = sets.find(s =>
              s.title.toLowerCase().includes(options.group.toLowerCase())
            );
            if (set) {
              setId = set.id;
            } else {
              errorOut(chalk.yellow(`Unknown group/collection: "${options.group}"`));
              errorOut(chalk.gray('Available groups: Nucleo UI, Nucleo Core, Nucleo Micro Bold'));
              errorOut(chalk.gray('Specialty collections: Nucleo Arcade, Nucleo Flags, Nucleo Credit Cards, etc.'));
              return;
            }
          }
        }

        icon = db.getIconByName(name, { groupId, setId });

        if (!icon) {
          if (options.group) {
            errorOut(chalk.red(`Icon "${name}" not found in ${options.group}.`));
            errorOut(chalk.yellow('\nTry searching to see available styles:'));
            errorOut(chalk.gray(`  nucleo search "${name}" --expand`));
          } else {
            errorOut(chalk.red(`Icon "${name}" not found.`));
            errorOut(chalk.yellow('\nTry searching first:'));
            errorOut(chalk.gray(`  nucleo search "${name}"`));
          }
          return;
        }
      }

      const sourcePath = db.getIconPath(icon);
      if (!existsSync(sourcePath)) {
        errorOut(chalk.red(`Icon file not found at ${sourcePath}`));
        return;
      }

      let svgContent = readFileSync(sourcePath, 'utf-8');

      // Apply color replacements if specified
      if (options.color || options.secondary) {
        svgContent = replaceColors(svgContent, options.color, options.secondary);
      }

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
        console.log(`  Style: ${chalk.magenta(icon.group_title || icon.set_title || `Set ${icon.set_id}`)}`);
        console.log(`  To: ${chalk.cyan(destPath)}`);
        console.log(`  Size: ${chalk.yellow(`${size}x${size}`)} pixels`);
        if (options.color) {
          console.log(`  Color: ${chalk.hex(options.color.startsWith('#') ? options.color : '#888')(options.color)}`);
        }
        return;
      }

      // Handle SVG output to stdout
      if (options.stdout) {
        process.stdout.write(svgContent);
        return;
      }

      // Write SVG to file
      const destDir = resolve(destination);
      const filename = options.output || `${icon.name}.svg`;
      const destPath = join(destDir, filename);

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
        console.log(chalk.gray(`Created directory: ${destDir}`));
      }

      writeFileSync(destPath, svgContent);

      console.log(chalk.green('✓ Icon copied successfully!'));
      console.log('');
      console.log(chalk.bold(`  ${icon.name}`));
      console.log(`  Style: ${chalk.magenta(icon.group_title || icon.set_title || `Set ${icon.set_id}`)}`);
      console.log(`  To: ${chalk.cyan(destPath)}`);

      const sizeMatch = svgContent.match(/viewBox="[^"]*"/);
      if (sizeMatch) {
        console.log(`  ViewBox: ${chalk.gray(sizeMatch[0])}`);
      }
      if (options.color) {
        console.log(`  Color: ${chalk.hex(options.color.startsWith('#') ? options.color : '#888')(options.color)}`);
      }
      if (options.secondary) {
        console.log(`  Secondary: ${chalk.hex(options.secondary.startsWith('#') ? options.secondary : '#888')(options.secondary)}`);
      }
    } catch (error) {
      console.error(chalk.red('Error copying icon:'), error);
    } finally {
      db.close();
    }
  });
