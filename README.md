# Mobile UX

A mobile-optimized UX enhancement plugin for [Obsidian](https://obsidian.md) that provides a floating action button (FAB), context-aware toolbars, haptic feedback, and wake lock support.

## Features

### 🔘 Floating Action Button (FAB)

- **Tap**: Creates a new note in your configured home folder
- **Long-press (500ms)**: Opens the command palette
- Anchored to the current editor leaf (doesn't overlap navigation)
- Auto-increment naming: `Untitled.md`, `Untitled 1.md`, `Untitled 2.md`, etc.
- Auto-creates the home folder if it doesn't exist
- Automatically focuses the editor after note creation

### 📱 Context-Aware Toolbars

Dynamic toolbars that adapt based on your cursor position and selection:

| Context | Description |
|---------|-------------|
| **Selection** | Text is selected |
| **List** | Cursor in bullet/ordered list |
| **Task** | Cursor in task list item |
| **Heading** | Cursor in heading |
| **Code Block** | Cursor in code block |
| **Table** | Cursor in table |
| **Blockquote** | Cursor in blockquote |
| **Link** | Cursor on a link |
| **Default** | Fallback when no other context matches |

#### Toolbar Features
- **Two-section settings**: Define toolbars in a library, then bind them to contexts
- **Auto-concatenation**: Multiple toolbars bound to the same context are automatically merged
- **Icon support**: Use Lucide icons with custom override capability
- **Horizontal scrolling**: Scrolls when too many buttons to fit
- **Editor focus preservation**: Keyboard stays open when using toolbar buttons

### 📳 Haptic Feedback

- 10ms vibration on button taps
- 20ms vibration on FAB long-press trigger
- Toggle on/off in settings
- Gracefully degrades on unsupported devices

### 🔒 Wake Lock

- **Toggle Wake Lock** command to keep screen awake during editing
- Status bar indicator shows "🔒 Wake Lock Active" when enabled
- Automatically releases when plugin unloads

### 🏠 Home Folder

- Configure a home folder for new notes
- Fuzzy search folder selection in settings
- Clear button to reset to vault root

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Go to **Community Plugins** and disable **Safe Mode**
3. Click **Browse** and search for "Mobile UX"
4. Click **Install** and then **Enable**

### Manual Installation

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/TheJusticeMan/obsidian-mobile-plugin/releases)
2. Create a folder named `mobile-ux` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into the `mobile-ux` folder
4. Reload Obsidian and enable the plugin in Settings → Community Plugins

## Configuration

### Settings

| Setting | Description |
|---------|-------------|
| **Home Folder** | Folder where new notes are created (empty = vault root) |
| **Use Icons** | Toggle between icon and text display in toolbars |
| **Haptic Feedback** | Enable/disable vibration on interactions |

### Toolbar Library

Create reusable toolbars with custom command sets:

1. Click **Add Toolbar**
2. Give it a name (e.g., "Formatting")
3. Add commands by their ID (e.g., `editor:toggle-bold`)
4. Optionally set custom icons for each command

### Context Bindings

Bind toolbars to editing contexts:

1. Click **Add Binding**
2. Select a context type (Selection, List, Table, etc.)
3. Select a toolbar from your library
4. Multiple bindings to the same context are auto-concatenated

## Commands

| Command | Description |
|---------|-------------|
| `Create New Note` | Creates a new note in the home folder |
| `Toggle Wake Lock` | Keeps the screen awake while editing |

## Development

### Prerequisites

- Node.js v16 or higher
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/TheJusticeMan/obsidian-mobile-plugin.git

# Install dependencies
npm install

# Build for development (watch mode)
npm run dev

# Build for production
npm run build
```

### Project Structure

```
src/
├── main.ts              # Plugin entry point
├── fab.ts               # Floating Action Button manager
├── toolbar-extension.ts # Context-aware toolbar ViewPlugin
└── settings.ts          # Settings tab and interfaces
```

## License

[MIT](LICENSE)

## Author

[TheJusticeMan](https://github.com/TheJusticeMan)

## Support

If you encounter any issues or have feature requests, please [open an issue](https://github.com/TheJusticeMan/obsidian-mobile-plugin/issues) on GitHub.
