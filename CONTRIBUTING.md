# Contributing to Nucleo Icons CLI

Thank you for your interest in contributing! This project aims to make Nucleo icons easily accessible via the command line.

## Getting Started

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/nucleo-icons-cli.git
   cd nucleo-icons-cli
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run in Development**
   ```bash
   npm run dev search "test"
   ```

4. **Build**
   ```bash
   npm run build
   ```

## Project Structure

- `src/commands/` - Individual CLI commands (search, sets, copy)
- `src/db/` - Database interface for querying Nucleo's SQLite database
- `src/utils/` - Utility functions (currently empty, but ready for helpers)
- `src/index.ts` - Main CLI entry point

## Adding a New Command

1. Create a new file in `src/commands/yourcommand.ts`
2. Export a Commander.js command
3. Import and register it in `src/index.ts`

Example:
```typescript
import { Command } from 'commander';
import { getNucleoDb } from '../db/index.js';

export const yourCommand = new Command('yourcommand')
  .description('Your command description')
  .action(() => {
    const db = getNucleoDb();
    try {
      // Your logic here
    } finally {
      db.close();
    }
  });
```

## Features We'd Love to See

- **Export templates** (React/Vue/Svelte components)
- **Interactive browse mode** with arrow key navigation
- **Bulk operations** (copy multiple icons at once)
- **Icon previews** in terminal (ASCII art or iTerm2 image protocol)
- **Favorites/collections** system
- **Better search** (fuzzy matching, relevance scoring)
- **Windows/Linux support** (currently Mac-only path hardcoded)

## Code Style

- Use TypeScript
- Use ES modules (`import`/`export`)
- Follow existing patterns in the codebase
- Keep dependencies minimal

## Testing

Currently, testing is manual. We'd love help adding:
- Unit tests
- Integration tests
- CI/CD pipeline

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Test thoroughly
4. Update README.md if needed
5. Submit a PR with a clear description

## Questions?

Open an issue for discussion before starting major work!
