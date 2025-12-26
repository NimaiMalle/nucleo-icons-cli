# Agent Instructions

> Copy this file to your project as `AGENTS.md` or append to your existing `CLAUDE.md`

## Nucleo Icons CLI

This project has access to the [Nucleo](https://nucleoapp.com/) icon library (51,000+ icons) via the `nucleo` CLI.

### Quick Reference

```bash
# Search for icons by name or tags
nucleo search "arrow"
nucleo search "download" --limit 10
nucleo search "user" --set "UI Essential"

# Copy an icon SVG to the project
nucleo copy "arrow-right" ./src/assets/icons
nucleo copy "download" ./public/icons --output download-icon.svg

# Preview an icon in the terminal
nucleo preview "arrow-right"

# List all icon sets
nucleo sets

# Interactive browser (if user wants to explore)
nucleo browse

# Fuzzy search with fzf (if installed)
nucleo fzf --query "arrow"
```

### Workflow

When the user asks for icons:

1. **Search** for relevant icons:
   ```bash
   nucleo search "shopping cart" --limit 5
   ```

2. **Preview** to verify it's the right one (optional):
   ```bash
   nucleo preview "cart"
   ```

3. **Copy** to the project:
   ```bash
   nucleo copy "cart" ./src/assets/icons
   ```

4. **Import** in code:
   ```tsx
   // React example
   import CartIcon from './assets/icons/cart.svg';
   ```

### Icon Styles

Nucleo has different style families - ask the user which they prefer if unclear:

| Style | Best For | Filter Flag |
|-------|----------|-------------|
| Nucleo UI | Small UI elements (12-18px) | `--set "UI"` |
| Nucleo Core | Medium/large display (24-48px) | `--set "Core"` |
| Nucleo Micro Bold | Tiny with bold strokes (20px) | `--set "Micro"` |

### Tips

- Icon names are kebab-case: `arrow-right`, `shopping-cart`, `user-circle`
- Use `--limit` to avoid overwhelming output
- The `nucleo copy` command creates the destination directory if needed
- SVG files can be used directly or converted to React/Vue components
