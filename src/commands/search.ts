import { Command } from 'commander';
import chalk from 'chalk';
import { getNucleoDb, ClusteredIcon } from '../db/index.js';

export const searchCommand = new Command('search')
  .description('Search for icons by name or tags. Use -term to exclude matches.')
  .argument('<query>', 'Search query (use -term to exclude, e.g., "arrow -circle")')
  .option('-s, --set <name>', 'Filter by icon set name')
  .option('-g, --group <name>', 'Filter by style group (UI, Core, Micro)')
  .option('-l, --limit <number>', 'Maximum number of results', '20')
  .option('-e, --expand', 'Show all style variants with full details')
  .action((query: string, options) => {
    const db = getNucleoDb();

    try {
      // Resolve group name to ID if provided
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
            console.log(chalk.yellow(`Unknown group/collection: "${options.group}"`));
            console.log(chalk.gray('Available groups: Nucleo UI, Nucleo Core, Nucleo Micro Bold'));
            console.log(chalk.gray('Specialty collections: Nucleo Arcade, Nucleo Flags, Nucleo Credit Cards, etc.'));
            return;
          }
        }
      }

      const limit = parseInt(options.limit, 10);

      if (options.expand) {
        // Expanded view: show all variants with full details
        const results = db.searchIcons(query, {
          set: options.set,
          groupId,
          setId,
          limit
        });

        if (results.length === 0) {
          console.log(chalk.yellow(`No icons found matching "${query}"`));
          return;
        }

        console.log(chalk.green(`Found ${results.length} icon(s):\n`));

        results.forEach((icon) => {
          console.log(chalk.bold.cyan(`${icon.name}`));
          console.log(`  ID: ${chalk.gray(icon.id)}`);
          console.log(`  Style: ${chalk.magenta(icon.group_title || 'Other')} / ${chalk.blue(icon.set_title || `Set ${icon.set_id}`)}`);
          if (icon.tags) {
            console.log(`  Tags: ${chalk.gray(icon.tags)}`);
          }
          console.log(`  Path: ${chalk.gray(db.getIconPath(icon))}`);
          console.log('');
        });
      } else {
        // Clustered view (default): group by icon name
        const results = db.searchIconsClustered(query, {
          set: options.set,
          groupId,
          setId,
          limit
        });

        if (results.length === 0) {
          console.log(chalk.yellow(`No icons found matching "${query}"`));
          return;
        }

        console.log(chalk.green(`Found ${results.length} unique icon(s):\n`));

        results.forEach((cluster) => {
          console.log(chalk.bold.cyan(`${cluster.name}`));

          // Show available styles
          const styleGroups = new Map<string, string[]>();
          for (const style of cluster.styles) {
            const group = style.group_title;
            if (!styleGroups.has(group)) {
              styleGroups.set(group, []);
            }
            styleGroups.get(group)!.push(style.set_title);
          }

          const styleStrs: string[] = [];
          for (const [group, sets] of styleGroups) {
            const uniqueSets = [...new Set(sets)];
            if (uniqueSets.length === 1 && uniqueSets[0] === group) {
              // Specialty collection (set name == group name)
              styleStrs.push(chalk.magenta(group));
            } else {
              styleStrs.push(`${chalk.magenta(group)}`);
            }
          }
          console.log(`  Styles: ${styleStrs.join(', ')}`);

          if (cluster.tags) {
            // Show truncated tags
            const tagList = cluster.tags.split(',').map(t => t.trim()).slice(0, 6);
            const tagStr = tagList.join(', ') + (cluster.tags.split(',').length > 6 ? ', ...' : '');
            console.log(`  Tags: ${chalk.gray(tagStr)}`);
          }
          console.log('');
        });

        console.log(chalk.gray(`Use --expand (-e) to see all style variants with paths`));
      }
    } finally {
      db.close();
    }
  });
