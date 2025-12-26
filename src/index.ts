#!/usr/bin/env node

import { Command } from 'commander';
import { searchCommand } from './commands/search.js';
import { setsCommand } from './commands/sets.js';
import { copyCommand } from './commands/copy.js';
import { browseCommand } from './commands/browse.js';
import { previewCommand } from './commands/preview.js';
import { fzfCommand } from './commands/fzf.js';

const program = new Command();

program
  .name('nucleo')
  .description('CLI tool for searching and using Nucleo icons')
  .version('1.0.0');

program.addCommand(searchCommand);
program.addCommand(setsCommand);
program.addCommand(copyCommand);
program.addCommand(browseCommand);
program.addCommand(previewCommand);
program.addCommand(fzfCommand);

program.parse();
