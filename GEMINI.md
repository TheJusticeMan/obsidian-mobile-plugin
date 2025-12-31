# Project Context: Obsidian Mobile Plugin

## Overview
This is an Obsidian plugin designed to enhance the mobile user experience. It introduces mobile-optimized features such as a Floating Action Button (FAB), context-aware toolbars, gesture support, a dedicated mobile search view, and a tab management view.

## Architecture

The project is built using **TypeScript** and the **Obsidian API**. It uses **CodeMirror 6** for editor enhancements (toolbars).

### Directory Structure (`src/`)

The source code has been organized into functional directories:

- **`src/main.ts`**: The plugin entry point. Handles lifecycle (onload, onunload), command registration, and view registration.
- **`src/settings.ts`**: Configuration logic, settings tab UI, and interface definitions.
- **`src/components/`**: Reusable UI components.
    - `SortableList.ts`: Drag-and-drop list component used in settings.
- **`src/features/`**: Core feature logic.
    - `fab.ts`: Manages the Floating Action Button (FAB) lifecycle and interactions.
    - `toolbar.ts`: A CodeMirror ViewPlugin that renders context-aware toolbars based on cursor position/selection.
    - `tab-gestures.ts`: Handles gestures in the mobile tab switcher (swipe to close, drag to reorder).
    - `sidebar-swipe.ts`: Implements "swipe past edge" to switch sidebar tabs.
    - `tablet-mode.ts`: Logic for forcing tablet UI on phone devices.
- **`src/views/`**: Custom Obsidian Views (Leaves).
    - `SearchLeaf.ts`: A custom, mobile-optimized search view with file previews and batch selection.
    - `TabsLeaf.ts`: A view displaying open tabs in a list format.
- **`src/utils/`**: Shared utilities.
    - `gesture-handler.ts`: Logic for capturing and recognizing 2D gestures (used by FAB).

## Key Features

1.  **Floating Action Button (FAB)**: Persistent button for quick actions, long-press commands, and custom drawn gestures.
2.  **Context-Aware Toolbars**: Dynamic toolbars that appear above the keyboard based on the active editing context (e.g., Markdown formatting when text is selected, list actions when in a list).
3.  **Gestures**: Custom 2D drawing gestures triggered from the FAB to execute arbitrary commands.
4.  **Mobile Search**: A high-performance search interface with sticky input, infinite scroll, and file previews.
5.  **Tabs View**: A vertical list of open tabs for easier management on small screens.
6.  **Tablet Mode**: Toggle to force Obsidian's tablet UI layout on phones.

## Development & Build

This project uses `npm` for dependency management and `esbuild` for bundling.

### Key Commands

- **Install Dependencies**: `npm install`
- **Build (Production)**: `npm run build`
    - Runs `format`, compiles TypeScript, and bundles with `esbuild`.
- **Development (Watch)**: `npm run dev`
    - Watches for changes and rebuilds incrementally.
- **Format Code**: `npm run format`
    - Uses `prettier` to format `.ts` and `.md` files.
- **Lint Code**: `npm run lint`
    - Uses `eslint`.
- **Release**: `npm run release`
    - script to automate release process.

### Conventions

- **Style**: Code is formatted using **Prettier**.
- **Linting**: Enforced via **ESLint** (`eslint-plugin-obsidianmd`).
- **Typings**: Uses `obsidian-typings` for type safety against the Obsidian API.
- **Imports**: Relative imports are used within `src/`.
