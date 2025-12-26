import { Command } from 'commander';
import chalk from 'chalk';
import { getNucleoDb } from '../db/index.js';

export const setsCommand = new Command('sets')
  .description('List all icon sets')
  .option('-v, --verbose', 'Show detailed information')
  .action((options) => {
    const db = getNucleoDb();

    try {
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
