# Nucleo Icons CLI

A command-line interface for searching and using [Nucleo](https://nucleoapp.com/) icons in your projects. Provides fast, local access to your Nucleo icon library with terminal previews and fuzzy search.

## Features

- **Search** 51,000+ icons by name or tags
- **Browse** 122 icon sets with an interactive TUI
- **Filter** by style family (UI, Core, Micro Bold) or specialty collections (Arcade, Flags, etc.)
- **Preview** icons directly in the terminal (iTerm2 inline images or ASCII/braille fallback)
- **Copy** SVG files directly to your project
- **Fuzzy search** with fzf integration (optional)
- **Agent-friendly** - perfect for AI coding assistants

## Prerequisites

- Node.js 18+
- [Nucleo Mac app](https://nucleoapp.com/) installed with icon library downloaded
- (Optional) [fzf](https://github.com/junegunn/fzf) for fuzzy search

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/nucleo-icons-cli.git
cd nucleo-icons-cli

# Install dependencies
npm install

# Build
npm run build

# Link globally
npm link
```

## Commands

### `nucleo search <query>`

Search for icons by name or tags.

```bash
nucleo search "arrow"
nucleo search "credit card"
nucleo search "user" --set "UI Essential"
nucleo search "home" --limit 20
```

Options:
- `-s, --set <name>` - Filter by icon set name
- `-l, --limit <n>` - Maximum results (default: 50)

### `nucleo browse`

Interactive browser with arrow-key navigation, previews, and filtering.

```bash
nucleo browse
```

Features:
- Search icons interactively
- Browse by icon set
- Filter by style family (Nucleo UI, Core, Micro Bold) or specialty collections (Arcade, Flags, etc.)
- Preview icons inline (iTerm2) or as ASCII/braille art
- Copy icons directly to your project

### `nucleo preview <name>`

Preview an icon in the terminal.

```bash
nucleo preview visa
nucleo preview heart --width 24
nucleo preview arrow-up --ascii
nucleo preview star --braille
```

Options:
- `-a, --ascii` - Force ASCII block rendering
- `-b, --braille` - Force braille rendering
- `-i, --iterm` - Force iTerm2 rendering
- `-w, --width <n>` - Preview width in characters (default: 32)

### `nucleo copy <name> [destination]`

Copy an icon SVG to your project.

```bash
nucleo copy visa
nucleo copy mastercard ./src/assets/icons
nucleo copy heart ./icons --output favorite.svg
```

Options:
- `-o, --output <filename>` - Custom output filename

### `nucleo sets`

List all available icon sets.

```bash
nucleo sets
nucleo sets --verbose
```

### `nucleo fzf`

Fuzzy search using fzf (requires fzf to be installed).

```bash
nucleo fzf
nucleo fzf --group UI
nucleo fzf --set Arcade
nucleo fzf --query "arrow"
```

Options:
- `-g, --group <name>` - Filter by style group (UI, Core, Micro)
- `-s, --set <name>` - Filter by set name
- `-q, --query <query>` - Initial search query

**Note:** Requires [fzf](https://github.com/junegunn/fzf) to be installed:
```bash
brew install fzf    # macOS
apt install fzf     # Ubuntu/Debian
```

## Terminal Preview Support

The CLI automatically detects your terminal and uses the best available preview:

| Terminal | Preview Type | Quality |
|----------|-------------|---------|
| iTerm2 | Inline images | Excellent |
| Other terminals | Braille characters | Good |
| Fallback | ASCII blocks | Basic |

Force a specific mode with `--ascii`, `--braille`, or `--iterm` flags.

## Icon Styles

Nucleo icons come in different style families optimized for different sizes:

| Style | Sizes | Best For |
|-------|-------|----------|
| Nucleo UI | 12px, 18px | Small UI elements |
| Nucleo Core | 24px, 32px, 48px | Medium to large display |
| Nucleo Micro Bold | 20px | Tiny sizes with bold strokes |

Plus specialty collections: Arcade, Credit Cards, Flags, Social Media, and more.

## Use with AI Coding Assistants

This CLI is designed to work well with AI coding assistants:

```bash
# Agent searches for an icon
nucleo search "download" --limit 5

# Agent copies it to the project
nucleo copy "download" ./src/assets/icons

# Agent can preview to verify
nucleo preview "download"
```

## How It Works

The Nucleo Mac app stores icons locally at:
- **Database:** `~/Library/Application Support/Nucleo/icons/data.sqlite3`
- **SVG files:** `~/Library/Application Support/Nucleo/icons/sets/{set_id}/{icon_id}.svg`

This CLI queries the SQLite database for metadata (names, tags, sets) and provides easy access to the SVG files.

## Development

```bash
# Run in development mode
npm run dev search "test"
npm run dev browse

# Build
npm run build

# Link for testing
npm link
```

## Project Structure

```
nucleo-icons-cli/
├── src/
│   ├── commands/
│   │   ├── browse.ts    # Interactive browser
│   │   ├── copy.ts      # Copy command
│   │   ├── fzf.ts       # Fuzzy search with fzf
│   │   ├── preview.ts   # Terminal preview
│   │   ├── search.ts    # Basic search
│   │   └── sets.ts      # List sets
│   ├── db/
│   │   └── index.ts     # SQLite database interface
│   ├── utils/
│   │   └── preview.ts   # Preview rendering (iTerm2, ASCII, braille)
│   └── index.ts         # CLI entry point
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT

## Disclaimer

This is an unofficial tool and is not affiliated with or endorsed by Nucleo. You must have a valid Nucleo license to use the icons. This CLI provides command-line access to icons you've already purchased and downloaded via the official Nucleo app.

## Credits

- [Nucleo](https://nucleoapp.com/) for the amazing icon library
- Built with [Commander.js](https://github.com/tj/commander.js), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [sharp](https://github.com/lovell/sharp), [Inquirer](https://github.com/SBoudrias/Inquirer.js), and [chalk](https://github.com/chalk/chalk)
