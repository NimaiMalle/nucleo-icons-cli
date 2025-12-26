import { Command } from 'commander';
import chalk from 'chalk';
import { spawn, execSync } from 'child_process';
import { getNucleoDb, Icon } from '../db/index.js';
import { getPreview, isITerm2 } from '../utils/preview.js';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { select, input } from '@inquirer/prompts';

/**
 * Check if fzf is installed
 */
function hasFzf(): boolean {
  try {
    execSync('which fzf', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Format an icon for fzf display
 * Format: "id|set_id|name|set_title|tags"
 */
function formatIconForFzf(icon: Icon): string {
  const tags = icon.tags || '';
  return `${icon.id}|${icon.set_id}|${icon.name}|${icon.set_title || ''}|${tags}`;
}

/**
 * Parse fzf output back to icon identifiers
 */
function parseIconFromFzf(line: string): { id: number; setId: number; name: string } | null {
  const parts = line.split('|');
  if (parts.length < 3) return null;
  return {
    id: parseInt(parts[0], 10),
    setId: parseInt(parts[1], 10),
    name: parts[2]
  };
}

/**
 * Run fzf with the given icons and return selected icon(s)
 */
async function runFzf(icons: Icon[], options: { multi?: boolean; query?: string } = {}): Promise<Icon[]> {
  return new Promise((resolve, reject) => {
    const args = [
      '--ansi',
      '--delimiter=|',
      '--with-nth=3,4,5',  // Show name, set_title, tags
      '--preview-window=hidden',
      '--height=80%',
      '--layout=reverse',
      '--border',
      '--prompt=Search icons: ',
      '--header=Type to search, Enter to select, Esc to cancel',
    ];

    if (options.multi) {
      args.push('--multi');
    }

    if (options.query) {
      args.push(`--query=${options.query}`);
    }

    const fzf = spawn('fzf', args, {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    // Feed icons to fzf
    const input = icons.map(formatIconForFzf).join('\n');
    fzf.stdin.write(input);
    fzf.stdin.end();

    let output = '';
    fzf.stdout.on('data', (data) => {
      output += data.toString();
    });

    fzf.on('close', (code) => {
      if (code === 130 || code === 1) {
        // User cancelled (Esc or Ctrl+C) or no match
        resolve([]);
        return;
      }

      const selectedLines = output.trim().split('\n').filter(Boolean);
      const selectedIcons: Icon[] = [];

      for (const line of selectedLines) {
        const parsed = parseIconFromFzf(line);
        if (parsed) {
          const icon = icons.find(i => i.id === parsed.id);
          if (icon) {
            selectedIcons.push(icon);
          }
        }
      }

      resolve(selectedIcons);
    });

    fzf.on('error', (err) => {
      reject(err);
    });
  });
}

async function showIconAndPrompt(icon: Icon, db: ReturnType<typeof getNucleoDb>): Promise<'copy' | 'another' | 'done'> {
  const iconPath = db.getIconPath(icon);

  console.log('\n' + chalk.bold.cyan(`━━━ ${icon.name} ━━━`));
  console.log(chalk.gray(`Set: ${icon.set_title || `Set ${icon.set_id}`}`));
  if (icon.tags) {
    console.log(chalk.gray(`Tags: ${icon.tags}`));
  }
  console.log('');

  try {
    const preview = await getPreview(iconPath);
    console.log(preview.content);
    if (preview.type === 'iterm2') {
      console.log(chalk.green('(iTerm2 inline preview)'));
    }
  } catch (error) {
    console.log(chalk.yellow('[Preview unavailable]'));
  }

  console.log('');
  console.log(chalk.gray(`Path: ${iconPath}`));
  console.log('');

  const action = await select({
    message: 'What would you like to do?',
    choices: [
      { name: chalk.green('Copy to project'), value: 'copy' as const },
      { name: chalk.blue('Search for another icon'), value: 'another' as const },
      { name: chalk.gray('Done'), value: 'done' as const }
    ],
    loop: false
  });

  return action;
}

async function copyIcon(icon: Icon, db: ReturnType<typeof getNucleoDb>): Promise<void> {
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

export const fzfCommand = new Command('fzf')
  .description('Fuzzy search icons using fzf (requires fzf to be installed)')
  .option('-g, --group <name>', 'Filter by style group (UI, Core, Micro)')
  .option('-s, --set <name>', 'Filter by set name')
  .option('-q, --query <query>', 'Initial search query')
  .action(async (options) => {
    // Check for fzf
    if (!hasFzf()) {
      console.log(chalk.red('Error: fzf is not installed.'));
      console.log('');
      console.log('Install it with:');
      console.log(chalk.cyan('  brew install fzf    # macOS'));
      console.log(chalk.cyan('  apt install fzf     # Ubuntu/Debian'));
      console.log(chalk.cyan('  pacman -S fzf       # Arch'));
      console.log('');
      console.log(chalk.gray('Or visit: https://github.com/junegunn/fzf#installation'));
      return;
    }

    const db = getNucleoDb();

    try {
      // Build filter options
      const searchOpts: { groupId?: number; setId?: number; limit: number } = { limit: 10000 };

      if (options.group) {
        const groups = db.getGroups();
        const group = groups.find(g => g.title.toLowerCase().includes(options.group.toLowerCase()));
        if (group) {
          searchOpts.groupId = group.id;
          console.log(chalk.gray(`Filtering by style: ${group.title}`));
        }
      }

      if (options.set) {
        const sets = db.getSets();
        const set = sets.find(s => s.title.toLowerCase().includes(options.set.toLowerCase()));
        if (set) {
          searchOpts.setId = set.id;
          console.log(chalk.gray(`Filtering by set: ${set.title}`));
        }
      }

      // Load icons
      console.log(chalk.gray('Loading icons...'));
      const icons = db.searchIcons('', searchOpts);
      console.log(chalk.gray(`Loaded ${icons.length.toLocaleString()} icons. Launching fzf...\n`));

      let continueSearching = true;

      while (continueSearching) {
        const selected = await runFzf(icons, { query: options.query });

        if (selected.length === 0) {
          console.log(chalk.gray('\nNo icon selected.'));
          break;
        }

        const icon = selected[0];
        const action = await showIconAndPrompt(icon, db);

        if (action === 'copy') {
          await copyIcon(icon, db);
        }

        if (action === 'done') {
          continueSearching = false;
        }

        // Clear the initial query after first search
        options.query = undefined;
      }

      console.log(chalk.gray('Goodbye!\n'));
    } catch (error) {
      if ((error as any)?.name === 'ExitPromptError') {
        console.log(chalk.gray('\n\nGoodbye!\n'));
      } else {
        throw error;
      }
    } finally {
      db.close();
    }
  });
