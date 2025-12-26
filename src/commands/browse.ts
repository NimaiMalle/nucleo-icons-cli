import { Command } from 'commander';
import chalk from 'chalk';
import {
  select,
  input,
  Separator
} from '@inquirer/prompts';
import { getNucleoDb, Icon, IconSet, IconGroup } from '../db/index.js';
import { getPreview, isITerm2 } from '../utils/preview.js';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const PAGE_SIZE = 15;

interface BrowseState {
  currentSet: IconSet | null;
  searchQuery: string;
  icons: Icon[];
  page: number;
}

// Unified filter can be either a style group OR a specialty set
interface FilterState {
  type: 'none' | 'group' | 'set';
  group: IconGroup | null;
  set: IconSet | null;
}

async function showIconPreview(icon: Icon, db: ReturnType<typeof getNucleoDb>): Promise<void> {
  const iconPath = db.getIconPath(icon);

  console.log('\n' + chalk.bold.cyan(`━━━ ${icon.name} ━━━`));
  console.log(chalk.gray(`Set: ${icon.set_title || `Set ${icon.set_id}`}`));
  if (icon.tags) {
    console.log(chalk.gray(`Tags: ${icon.tags}`));
  }
  console.log('');

  try {
    const preview = await getPreview(iconPath);

    if (preview.type === 'iterm2') {
      console.log(preview.content);
      console.log(chalk.green('(iTerm2 inline preview)'));
    } else {
      console.log(chalk.dim('Preview:'));
      console.log(preview.content);
      console.log(chalk.gray(`(${preview.type} rendering)`));
    }
  } catch (error) {
    console.log(chalk.yellow('[Preview unavailable]'));
  }

  console.log('');
  console.log(chalk.gray(`Path: ${iconPath}`));
  console.log('');
}

async function copyIconToProject(icon: Icon, db: ReturnType<typeof getNucleoDb>): Promise<void> {
  const destination = await input({
    message: 'Copy to directory:',
    default: './icons'
  });

  const filename = await input({
    message: 'Filename:',
    default: `${icon.name}.svg`
  });

  const sourcePath = db.getIconPath(icon);
  const destDir = resolve(destination);
  const destPath = join(destDir, filename);

  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  copyFileSync(sourcePath, destPath);
  console.log(chalk.green(`\n✓ Copied to ${destPath}\n`));
}

async function browseIcons(state: BrowseState, db: ReturnType<typeof getNucleoDb>): Promise<'back' | 'exit'> {
  while (true) {
    const totalPages = Math.ceil(state.icons.length / PAGE_SIZE);
    const start = state.page * PAGE_SIZE;
    const pageIcons = state.icons.slice(start, start + PAGE_SIZE);

    const choices: any[] = pageIcons.map((icon) => ({
      name: `${chalk.cyan(icon.name)} ${chalk.gray(`- ${icon.set_title || 'Set ' + icon.set_id}`)}`,
      value: icon
    }));

    choices.push(new Separator());

    if (state.page > 0) {
      choices.push({ name: chalk.yellow('← Previous page'), value: 'prev' });
    }
    if (state.page < totalPages - 1) {
      choices.push({ name: chalk.yellow('Next page →'), value: 'next' });
    }
    choices.push({ name: chalk.gray('↩ Back to menu'), value: 'back' });
    choices.push({ name: chalk.red('Exit'), value: 'exit' });

    const headerInfo = state.currentSet
      ? `Set: ${state.currentSet.title}`
      : state.searchQuery
        ? `Search: "${state.searchQuery}"`
        : 'All icons';

    const answer = await select({
      message: `${headerInfo} (${state.icons.length} icons, page ${state.page + 1}/${totalPages})`,
      choices,
      pageSize: PAGE_SIZE + 5,
      loop: false
    });

    if (answer === 'prev') {
      state.page--;
      continue;
    } else if (answer === 'next') {
      state.page++;
      continue;
    } else if (answer === 'back') {
      return 'back';
    } else if (answer === 'exit') {
      return 'exit';
    }

    // User selected an icon
    const selectedIcon = answer as Icon;
    await showIconPreview(selectedIcon, db);

    const action = await select({
      message: 'What would you like to do?',
      choices: [
        { name: chalk.green('Copy to project'), value: 'copy' },
        { name: chalk.blue('View another icon'), value: 'continue' },
        { name: chalk.gray('Back to list'), value: 'back' }
      ],
      loop: false
    });

    if (action === 'copy') {
      await copyIconToProject(selectedIcon, db);
    } else if (action === 'back') {
      continue;
    }
  }
}

async function selectStyleFilter(db: ReturnType<typeof getNucleoDb>, currentFilter: FilterState): Promise<FilterState> {
  const groups = db.getGroups();
  const specialtySets = db.getUngroupedSets();

  const choices: any[] = [
    { name: chalk.gray('↩ Back (keep current filter)'), value: { action: 'back' } },
    new Separator(),
    {
      name: currentFilter.type !== 'none'
        ? `${chalk.yellow('Clear filter')} ${chalk.gray('(show all 51,000+ icons)')}`
        : `${chalk.dim('No filter')} ${chalk.gray('(already showing all)')}`,
      value: { action: 'clear' }
    },
    new Separator(' Style Families '),
  ];

  // Add style groups
  groups.forEach(group => {
    const isActive = currentFilter.type === 'group' && currentFilter.group?.id === group.id;
    const marker = isActive ? chalk.green('● ') : '  ';
    choices.push({
      name: `${marker}${chalk.cyan(group.title)} ${chalk.gray(`(${group.icons_count.toLocaleString()} icons, sizes: ${group.sizes})`)}`,
      value: { action: 'group', group }
    });
  });

  choices.push(new Separator(' Specialty Collections '));

  // Add specialty/ungrouped sets
  specialtySets.forEach(set => {
    const isActive = currentFilter.type === 'set' && currentFilter.set?.id === set.id;
    const marker = isActive ? chalk.green('● ') : '  ';
    choices.push({
      name: `${marker}${chalk.yellow(set.title)} ${chalk.gray(`(${set.icons_count} icons)`)}`,
      value: { action: 'set', set }
    });
  });

  const selected = await select({
    message: 'Select icon style or collection:',
    choices,
    pageSize: 15,
    loop: false
  });

  const selection = selected as { action: string; group?: IconGroup; set?: IconSet };

  if (selection.action === 'back') {
    return currentFilter;
  }

  if (selection.action === 'clear') {
    return { type: 'none', group: null, set: null };
  }

  if (selection.action === 'group' && selection.group) {
    return { type: 'group', group: selection.group, set: null };
  }

  if (selection.action === 'set' && selection.set) {
    return { type: 'set', group: null, set: selection.set };
  }

  return currentFilter;
}

function getFilterLabel(filter: FilterState): string {
  if (filter.type === 'group' && filter.group) {
    return chalk.magenta(`[${filter.group.title}]`);
  }
  if (filter.type === 'set' && filter.set) {
    return chalk.yellow(`[${filter.set.title}]`);
  }
  return chalk.gray('[All styles]');
}

function getFilterQueryOptions(filter: FilterState): { groupId?: number; setId?: number } {
  if (filter.type === 'group' && filter.group) {
    return { groupId: filter.group.id };
  }
  if (filter.type === 'set' && filter.set) {
    return { setId: filter.set.id };
  }
  return {};
}

async function mainMenu(db: ReturnType<typeof getNucleoDb>): Promise<void> {
  const filter: FilterState = { type: 'none', group: null, set: null };

  const terminal = isITerm2()
    ? chalk.green('iTerm2 detected - full image preview available!')
    : chalk.gray('Standard terminal - braille preview mode');

  console.log('');
  console.log(chalk.bold.cyan('┌──────────────────────────────────────┐'));
  console.log(chalk.bold.cyan('│       Nucleo Icons Browser           │'));
  console.log(chalk.bold.cyan('└──────────────────────────────────────┘'));
  console.log(`  ${terminal}`);
  console.log('');

  while (true) {
    // Get stats based on current filter
    const filterOpts = getFilterQueryOptions(filter);
    const stats = filter.type === 'set' && filter.set
      ? { totalIcons: filter.set.icons_count, totalSets: 1 }
      : db.getStats(filterOpts.groupId);
    const filterLabel = getFilterLabel(filter);

    const filterOptionName = filter.type !== 'none'
      ? `🎨 Change filter ${filterLabel}`
      : `🎨 Set style filter ${filterLabel}`;

    // When filtering by a specialty set, hide "Browse by set" since there's only one
    const menuChoices: any[] = [
      { name: `🔍 Search icons`, value: 'search' },
    ];

    if (filter.type !== 'set') {
      menuChoices.push({ name: `📦 Browse by set`, value: 'sets' });
    }

    menuChoices.push(
      { name: `⭐ View all icons`, value: 'all' },
      new Separator(),
      { name: filterOptionName, value: 'filter' },
      new Separator(),
      { name: chalk.red('Exit'), value: 'exit' }
    );

    const mainChoice = await select({
      message: `${stats.totalIcons.toLocaleString()} icons${filter.type !== 'set' ? ` in ${stats.totalSets} sets` : ''} ${filterLabel}`,
      choices: menuChoices,
      loop: false
    });

    if (mainChoice === 'exit') {
      console.log(chalk.gray('\nGoodbye!\n'));
      break;
    }

    if (mainChoice === 'filter') {
      const newFilter = await selectStyleFilter(db, filter);
      filter.type = newFilter.type;
      filter.group = newFilter.group;
      filter.set = newFilter.set;

      if (newFilter.type === 'group' && newFilter.group) {
        console.log(chalk.green(`\n✓ Filter set to: ${newFilter.group.title}\n`));
      } else if (newFilter.type === 'set' && newFilter.set) {
        console.log(chalk.green(`\n✓ Filter set to: ${newFilter.set.title}\n`));
      } else if (newFilter.type === 'none') {
        console.log(chalk.gray('\n✓ Filter cleared - showing all styles\n'));
      }
      continue;
    }

    if (mainChoice === 'search') {
      const query = await input({
        message: 'Search query:',
        validate: (val) => val.length > 0 || 'Please enter a search term'
      });

      const icons = db.searchIcons(query, { ...filterOpts, limit: 500 });

      const filterName = filter.type === 'group' ? filter.group?.title : filter.type === 'set' ? filter.set?.title : null;
      if (icons.length === 0) {
        console.log(chalk.yellow(`\nNo icons found matching "${query}"${filterName ? ` in ${filterName}` : ''}\n`));
        continue;
      }

      const state: BrowseState = {
        currentSet: null,
        searchQuery: query,
        icons,
        page: 0
      };

      const result = await browseIcons(state, db);
      if (result === 'exit') break;
    }

    if (mainChoice === 'sets') {
      const sets = db.getSets(filterOpts.groupId);

      const setChoices: any[] = [
        { name: chalk.gray('↩ Back to main menu'), value: null },
        new Separator()
      ];

      sets.forEach(set => {
        setChoices.push({
          name: `${chalk.cyan(set.title)} ${chalk.gray(`(${set.icons_count} icons)`)}`,
          value: set
        });
      });

      const selectedSet = await select({
        message: `Select an icon set ${filterLabel}:`,
        choices: setChoices,
        pageSize: 20,
        loop: false
      });

      if (!selectedSet) continue;

      const icons = db.getIconsFromSet(selectedSet.id, 1000);

      const state: BrowseState = {
        currentSet: selectedSet,
        searchQuery: '',
        icons,
        page: 0
      };

      const result = await browseIcons(state, db);
      if (result === 'exit') break;
    }

    if (mainChoice === 'all') {
      const icons = db.searchIcons('', { ...filterOpts, limit: 500 });

      const state: BrowseState = {
        currentSet: filter.type === 'set' ? filter.set : null,
        searchQuery: '',
        icons,
        page: 0
      };

      const result = await browseIcons(state, db);
      if (result === 'exit') break;
    }
  }
}

export const browseCommand = new Command('browse')
  .description('Interactive icon browser with preview')
  .action(async () => {
    const db = getNucleoDb();

    try {
      await mainMenu(db);
    } catch (error) {
      if ((error as any)?.name === 'ExitPromptError') {
        // User pressed Ctrl+C
        console.log(chalk.gray('\n\nGoodbye!\n'));
      } else {
        throw error;
      }
    } finally {
      db.close();
    }
  });
