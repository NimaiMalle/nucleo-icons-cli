import { Command } from 'commander';
import chalk from 'chalk';
import { getNucleoDb } from '../db/index.js';

export const searchCommand = new Command('search')
  .description('Search for icons by name or tags')
  .argument('<query>', 'Search query')
  .option('-s, --set <name>', 'Filter by icon set name')
  .option('-l, --limit <number>', 'Maximum number of results', '50')
  .action((query: string, options) => {
    const db = getNucleoDb();

    try {
      const results = db.searchIcons(query, {
        set: options.set,
        limit: parseInt(options.limit, 10)
      });

      if (results.length === 0) {
        console.log(chalk.yellow(`No icons found matching "${query}"`));
        return;
      }

      console.log(chalk.green(`Found ${results.length} icon(s):\n`));

      results.forEach((icon) => {
        console.log(chalk.bold.cyan(`${icon.name}`));
        console.log(`  ID: ${chalk.gray(icon.id)}`);
        console.log(`  Set: ${chalk.blue(icon.set_title || `Set ${icon.set_id}`)}`);
        if (icon.tags) {
          console.log(`  Tags: ${chalk.gray(icon.tags)}`);
        }
        console.log(`  Path: ${chalk.gray(db.getIconPath(icon))}`);
        console.log('');
      });
    } finally {
      db.close();
    }
  });
