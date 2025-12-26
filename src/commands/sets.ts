import { Command } from 'commander';
import chalk from 'chalk';
import { getNucleoDb } from '../db/index.js';

export const setsCommand = new Command('sets')
  .description('List all icon sets')
  .option('-v, --verbose', 'Show detailed information')
  .option('-g, --groups', 'List style groups and specialty collections (for use with --group filter)')
  .action((options) => {
    const db = getNucleoDb();

    try {
      if (options.groups) {
        // List groups and specialty collections
        const groups = db.getGroups();
        const specialtySets = db.getUngroupedSets();

        console.log(chalk.green('\n── Style Families ──\n'));
        console.log(chalk.gray('Filter with: nucleo search "" --group "<name>"\n'));

        groups.forEach((group) => {
          console.log(chalk.bold.magenta(`${group.title}`));
          console.log(`  Icons: ${chalk.yellow(group.icons_count.toLocaleString())}`);
          console.log(`  Sizes: ${chalk.gray(group.sizes)}`);
          console.log('');
        });

        console.log(chalk.green('── Specialty Collections ──\n'));

        specialtySets.forEach((set) => {
          console.log(chalk.bold.yellow(`${set.title}`));
          console.log(`  Icons: ${chalk.yellow(set.icons_count)}`);
          console.log('');
        });

        return;
      }

      const sets = db.getSets();
      const stats = db.getStats();

      console.log(chalk.green(`\nTotal: ${stats.totalSets} sets, ${stats.totalIcons} icons\n`));

      sets.forEach((set) => {
        console.log(chalk.bold.cyan(`${set.title}`));
        console.log(`  ID: ${chalk.gray(set.id)}`);
        console.log(`  Icons: ${chalk.yellow(set.icons_count)}`);
        if (options.verbose) {
          console.log(`  Local: ${set.local ? chalk.green('✓') : chalk.red('✗')}`);
          console.log(`  Demo: ${set.demo ? chalk.yellow('Yes') : chalk.gray('No')}`);
        }
        console.log('');
      });
    } finally {
      db.close();
    }
  });
