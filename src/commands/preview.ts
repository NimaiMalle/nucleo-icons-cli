import { Command } from 'commander';
import chalk from 'chalk';
import { getNucleoDb } from '../db/index.js';
import { getPreview, isITerm2, svgToAscii, svgToBraille, displayInITerm2 } from '../utils/preview.js';

export const previewCommand = new Command('preview')
  .description('Preview an icon in the terminal')
  .argument('<name>', 'Icon name')
  .option('-a, --ascii', 'Force ASCII block rendering')
  .option('-b, --braille', 'Force braille rendering')
  .option('-i, --iterm', 'Force iTerm2 rendering (if supported)')
  .option('-w, --width <n>', 'Preview width in characters (default: 32 for ascii/braille, 16 for iTerm2)', '32')
  .action(async (name: string, options) => {
    const db = getNucleoDb();

    try {
      const icon = db.getIconByName(name);

      if (!icon) {
        console.log(chalk.red(`Icon "${name}" not found.`));
        console.log(chalk.yellow('\nTry searching first:'));
        console.log(chalk.gray(`  nucleo search "${name}"`));
        return;
      }

      const iconPath = db.getIconPath(icon);

      console.log('');
      console.log(chalk.bold.cyan(`━━━ ${icon.name} ━━━`));
      console.log(chalk.gray(`Set: ${icon.set_title || `Set ${icon.set_id}`}`));
      if (icon.tags) {
        console.log(chalk.gray(`Tags: ${icon.tags}`));
      }
      console.log(chalk.gray(`Path: ${iconPath}`));
      console.log('');

      const width = parseInt(options.width, 10);

      // Determine render mode
      if (options.iterm) {
        if (!isITerm2()) {
          console.log(chalk.yellow('Warning: iTerm2 not detected. Preview may not display correctly.'));
        }
        const preview = await displayInITerm2(iconPath, 400, width);
        console.log(preview);
        console.log(chalk.green(`\n(iTerm2 inline image, ${width} cells wide)`));
      } else if (options.ascii) {
        const preview = await svgToAscii(iconPath, width);
        console.log(preview);
        console.log(chalk.gray('\n(ASCII block rendering)'));
      } else if (options.braille) {
        const preview = await svgToBraille(iconPath, width);
        console.log(preview);
        console.log(chalk.gray('\n(Braille rendering)'));
      } else {
        // Auto-detect best mode
        const preview = await getPreview(iconPath, { width });
        console.log(preview.content);
        console.log(chalk.gray(`\n(${preview.type} rendering - auto-detected)`));
      }

      console.log('');
    } finally {
      db.close();
    }
  });
