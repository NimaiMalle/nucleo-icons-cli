# Nucleo Icons CLI

A command-line interface for searching and using [Nucleo](https://nucleoapp.com/) icons in your projects. Provides fast, local access to your Nucleo icon library with terminal previews and fuzzy search.

## Features

- **Smart search** - searches across names, tags, sets, and style families automatically
- **Relevance ranking** - exact matches and name matches ranked higher than tag/set matches
- **Negation** - exclude terms with `-` prefix (e.g., `arrow -circle`)
- **Clustered results** - groups duplicate icons across styles for cleaner output
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
git clone https://github.com/NimaiMalle/nucleo-icons-cli.git
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

Search for icons by name, tags, set, or style. Results are clustered by icon name and ranked by relevance.

```bash
# Basic search
nucleo search "arrow"
nucleo search "credit card"

# Smart cross-field search (finds "recycle" tag in "Nucleo Arcade" set)
nucleo search "arcade recycle"

# Exclude terms with - prefix
nucleo search "arrow -circle"
nucleo search "user -avatar -circle"

# Show all style variants with full paths
nucleo search "download" --expand

# Filter by set or group
nucleo search "home" --set "UI Essential"
nucleo search "arrow" --group "Micro Bold"
```

Options:
- `-s, --set <name>` - Filter by icon set name
- `-g, --group <name>` - Filter by style group (UI, Core, Micro) or specialty collection
- `-l, --limit <n>` - Maximum results (default: 20)
- `-e, --expand` - Show all style variants with IDs and paths

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

Copy an icon SVG to your project, or export as PNG.

```bash
nucleo copy visa
nucleo copy mastercard ./src/assets/icons
nucleo copy heart ./icons --output favorite.svg

# Export as PNG (transparent background)
nucleo copy download --png                    # 64x64 PNG (default)
nucleo copy download --png --size 128         # 128x128 PNG
nucleo copy download ./assets --png --size 32 # 32x32 PNG to ./assets/download.png

# Output to stdout (for piping or inline use)
nucleo copy download --stdout
nucleo copy download --stdout | pbcopy        # copy SVG to clipboard (macOS)
nucleo copy download --png --stdout > icon.png
```

Options:
- `-o, --output <filename>` - Custom output filename
- `--stdout` - Output file content to stdout instead of writing to file
- `--png` - Export as PNG instead of SVG (transparent background)
- `--size <pixels>` - PNG size in pixels (default: 64)

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

This CLI is designed to work well with AI coding assistants. The smart search means agents don't need to understand Nucleo's taxonomy:

```bash
# Agent searches naturally - works across names, tags, sets, and styles
nucleo search "arcade game controller"
nucleo search "flags usa"
nucleo search "download -arrow"

# Agent sees clustered results showing available styles
# download
#   Styles: Nucleo UI, Nucleo Core, Nucleo Micro Bold
#   Tags: arrow, bottom, save, receive, import, download

# Agent copies it to the project
nucleo copy "download" ./src/assets/icons

# Agent can preview to verify
nucleo preview "download"
```

See `AGENTS.sample.md` for a template to add to your project's agent instructions.

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
