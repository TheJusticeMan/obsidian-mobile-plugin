# Changelog

All notable changes to the Mobile UX plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2025-12-20

### Added

- **Tabs**: Added a new "Tabs" view that displays a list of open tabs for quick navigation.
- **Tabs**: Added "Open tabs" command to open the new Tabs view.
- **Search**: Added folder selection mode. Pressing Backspace on an empty search input toggles between file and folder selection modes. Exiting folder mode with backspace clears the current folder filter.
- **Search**: Added confirmation dialog when deleting multiple files to prevent accidental deletions.

### Fixed

- **FAB**: Fixed an issue where the Floating Action Button would not appear on some leaves by ensuring it is initialized for all root leaves.
- **Gestures**: Updated tab gestures to only iterate over root leaves, improving performance and correctness.

### Changed

- **Internal**: Renamed `mobile-search-leaf.ts` to `MobileSearchLeaf.ts` for consistency.
- **Internal**: Removed `throttleWithInterval.ts` utility and replaced it with the `apocalypse-throttle` package.

## [1.3.2] - 2025-12-20

### Fixed

- **FAB**: Fixed FAB appearing on navigator leaves.

## [1.3.1] - 2025-12-19

### Fixed

- **Search**: Fixed search pane opening empty after scrolling and reopening by resetting scroll position to prevent race conditions during initial render.
- **FAB**: Fixed FAB not appearing on some leaves by ensuring FABs are created for all leaves when no active leaf is provided.

## [1.3.0] - 2025-12-15

### Added

- **Gestures**: Added mobile tab gestures for swiping to close tabs and drag-and-drop to reorder/merge leaves in the tab switcher.
- **Search**: Added option to show open tabs in the mobile search view for quick navigation.
- **Settings**: Added built-in toolbar toggle to settings for enabling/disabling Obsidian's native mobile toolbar.
- **Styles**: Updated styles to improve toolbar appearance and compatibility with built-in toolbar toggle.
- **Toolbar**: Significantly expanded context-aware toolbars.
  - Added new toolbars: `Table actions`, `Heading actions`, `Code block actions`, `Blockquote actions`, `Link actions`, `Selection`, and `All commands`.
  - Added support for new contexts: `task`, `heading`, `code-block`, `table`, `blockquote`, and `link`.
  - Added many new commands to default toolbars for better mobile accessibility.
  - Added custom icons for heading and table commands.

### Changed

- **Toolbar**: Improved toolbar rendering logic and context detection prioritization.
- **Toolbar**: Renamed `showTooltip` to `renderToolbar` for clarity.

### Fixed

- **Search**: Fixed search panel menu selection logic to correctly reflect file count and selection state.
- **Performance**: Updated `throttleWithInterval` to prevent overlapping executions of async callbacks, ensuring smoother search and scroll handling.

## [1.2.4] - 2025-12-15

### Added

- **Tablet Mode**: Added icon to "Toggle keep in tablet mode" command.
- **Toolbar**: Added default icon fallback for commands without icons.

### Changed

- **Refactoring**: Centralized `CommandManager` type definitions in `main.ts` and updated all files to use it, removing duplicate interfaces.
- **Search**: Renamed "Search" view to "Quick search".
- **Internal**: Improved type safety for accessing Obsidian's internal commands API.

### Fixed

- **Toolbar**: Added safety checks for tooltip creation to prevent potential errors.

## [1.2.2] - 2025-12-12

### Changed

- **Type Safety Improvements**: Replaced `any` type assertions with proper TypeScript interfaces
  - Added `ObsidianCommandsAPI` interface for accessing internal commands API
  - Added `ObsidianFileManagerAPI` interface for file manager operations
  - Added `NavigatorWithWakeLock` interface for Wake Lock API
  - Changed type assertions from `as any` to `as unknown as InterfaceName` for safer type narrowing
- **Code Quality**: Removed unnecessary `async` keywords from callbacks that don't use `await`
  - Updated event handlers in settings.ts (onClick, onChange callbacks)
  - Updated command callbacks in main.ts that don't perform async operations
- **Better Type Narrowing**: Improved TypeScript type predicates
  - Changed filter to use type predicate `f is TFolder` instead of type assertion

### Documentation

- Updated CHANGELOG.md to properly document version 1.2.1 changes

## [1.2.1] - 2025-12-11

### Changed

- **ESLint Migration**: Migrated from legacy `.eslintrc` to ESLint v9 flat config format (`eslint.config.mjs`)
- **Dependency Updates**: Updated ESLint and TypeScript dependencies for better compatibility
  - Updated TypeScript ESLint packages to version 8.49.0
  - Updated eslint to version 9.39.1
  - Removed legacy `.eslintrc` and `.eslintignore` files

### Fixed

- **Linting Errors**: Fixed all ESLint errors across the codebase
  - Improved type safety by removing unnecessary `any` type assertions
  - Fixed unsafe type access patterns with proper eslint-disable comments
  - Removed unused event parameters from `onChooseItem` callbacks
  - Cleaned up async function handling in event callbacks
  - Fixed Obsidian-specific linting issues using `eslint-plugin-obsidianmd`

### Code Quality

- Removed unnecessary eslint-disable comments throughout the codebase
- Improved TypeScript type assertions and narrowing
- Simplified callback signatures by removing unused parameters

## [1.2.0] - 2025-12-09

### Added

#### Mobile Search Plugin Extensibility

- **`files-menu` Event Support**: Mobile search selection mode now triggers Obsidian's `files-menu` event when multiple files are selected
  - Allows other plugins to extend the context menu with custom bulk actions
  - Triggers `file-menu` event for single file selection (matching Obsidian's native behavior)
  - Enables seamless integration with file management plugins
- **Dynamic Select All Button**: The select all button now intelligently toggles based on selection state
  - Shows "Select all" when some or no files are selected
  - Changes to "Deselect all" when all files are selected
  - Provides clear visual feedback and reversible action

### Changed

#### Mobile Search Selection Mode Improvements

- **Simplified Entry Method**: Replaced swipe gesture with context menu to enter selection mode
  - Long-press or right-click on any file card to enter selection mode and select that file
  - Removed 62 lines of swipe detection code for cleaner, more maintainable implementation
  - More intuitive and discoverable interaction pattern
- **Smart Menu Routing**: Context menu adapts based on selection count
  - 0 files selected → Automatically exits selection mode
  - 1 file selected → Shows single file menu with `file-menu` event
  - Multiple files selected → Shows multiple files menu with `files-menu` event
- **Lazy-Load Selection Support**: Files selected via "Select all" now properly show selection UI
  - Cards check selection state when rendered during scrolling
  - Ensures visual consistency for all selected files, even those not initially visible
  - Fixed issue where only first 10 files showed selection indicator

- **Removed Built-in Delete Action**: Bulk delete functionality removed from plugin
  - Allows file management plugins to provide their own delete implementations via `files-menu` event
  - Gives users and plugin developers full control over bulk actions
  - Maintains consistency with Obsidian's plugin extensibility model

### Fixed

- Selection state now persists correctly across infinite scroll boundaries
- Select all button text updates properly when selection changes
- Context menu positioning improved with optional event parameter handling

## [1.1.1] - 2025-12-09

### Fixed

- **Build Errors**: Fixed TypeScript compilation errors in mobile-search-leaf.ts
  - Made event parameter optional in `showMultipleFilesMenu()` method
  - Fixed ExtraButtonComponent onClick callback signature to match expected type `() => any`
  - Menu now shows at center screen position when no mouse event is provided
  - Maintains backwards compatibility with contextmenu event handling

## [1.1.0] - 2025-12-08

### Added

#### Mobile Search Selection Mode

- **Swipe-to-Select**: Swipe right on any search result card to enter selection mode
  - Intuitive gesture-driven selection for bulk operations
  - Visual feedback: card slides right (up to 80px) during swipe
  - Smart detection distinguishes horizontal swipes from vertical scrolls
  - Threshold: 50px horizontal movement within 500ms
- **Selection Command Bar**: Replaces search bar when in selection mode
  - **Cancel button**: Exit selection mode and return to search
  - **Select All button**: Select all visible search results at once
  - **Selection counter**: Live display showing "X selected"
  - **Three-dot menu (•••)**: Opens bulk actions menu
- **Dynamic Card Behavior**: Context-aware interaction modes
  - Normal mode: Click opens file, context menu shows file options
  - Selection mode: Click toggles selection, context menu on selected card shows bulk actions
- **Bulk Operations**: Multiple files menu with error handling
  - **Delete files**: Delete all selected files with per-file error handling
  - User feedback via Notice API showing success/failure counts
  - Graceful handling of partial failures
- **Visual Selection Indicators**
  - Selected cards display 2px border with `--accent` color
  - Box shadow with accent color for depth
  - Checkmark (✓) badge in top-right corner
  - Highlighted background color
  - Smooth transitions for visual feedback

### Changed

- Mobile search cards now support touch gesture detection for selection mode
- Search bar visibility toggles dynamically based on selection mode state
- Card click handlers now check selection mode before opening files

## [1.0.10] - 2025-12-07

### Fixed

- **Mobile Search Race Condition**: Fixed issue where search view would randomly appear empty on first open or when reopening with existing text
  - Added `isSearching` guard flag to prevent concurrent `performSearch()` executions
  - Multiple code paths (onOpen, IntersectionObserver, onResize) were triggering simultaneous searches
  - Results container was being cleared by competing async operations
  - Used try-finally block to ensure flag is always reset

- **Toolbar Expand Gesture Flickering**: Fixed flickering behavior when swiping to expand toolbar
  - Removed 300ms time constraint (`SWIPE_THRESHOLD_MS`) that was causing multiple toggles
  - Added `hasToggled` flag to ensure toolbar only toggles once per swipe gesture
  - Gesture now responds immediately when 30px swipe threshold is met

### Changed

- **Toolbar Layout Enhancement**: Toolbar now expands to full width when FAB is hidden
  - Uses CSS `:has()` pseudo-class to detect FAB presence
  - Toolbar automatically adjusts from `right: 86px` to `right: 10px` when FAB is disabled
  - Added smooth transitions for better UX

## [1.0.9] - 2025-12-06

### Added

#### Editor Navigation Commands

- **Cursor Navigation**: 4 new commands for precise cursor movement
  - `Up` - Move cursor up one line (icon: arrow-up)
  - `Down` - Move cursor down one line (icon: arrow-down)
  - `Left` - Move cursor left one character with line wrapping (icon: arrow-left)
  - `Right` - Move cursor right one character with line wrapping (icon: arrow-right)

#### Selection Commands

- **Selection Expand**: 2 commands to expand selection to word boundaries
  - `Expand down` - Extend selection to next word boundary or line end (icon: chevrons-down)
  - `Expand up` - Extend selection backward to previous word boundary (icon: chevrons-up)

- **Selection Contract**: 2 commands to shrink selection
  - `Shrink down` - Deselect text from end (icon: chevron-down)
  - `Shrink up` - Deselect text from start (icon: chevron-up)

- **Smart Selection**: 4 commands for intelligent text selection
  - `Select word` - Select word at cursor, finds next word if on whitespace (icon: text-cursor)
  - `Select sentence` - Select sentence at cursor, bounded by `.!?` (icon: type)
  - `Select line` - Select entire line including newline (icon: minus)
  - `Select all` - Select entire document (icon: file-text)

- **Progressive Selection**: Single command for expanding selection incrementally
  - `Select more` - Progressively expands: nothing → word → sentence → line → all (icon: maximize-2)

### Changed

#### Toolbar Improvements

- **Contextual Command Availability**: Toolbar buttons now hide when commands are unavailable
  - Added `isCommandAvailable()` function that evaluates `checkCallback` and `editorCheckCallback`
  - Improved UX by showing only relevant commands based on current context
  - Added error logging for debugging command availability issues

- **Toolbar Layout Fix**: Resolved FAB overlap issue
  - Set toolbar `right: 86px` and `max-width: calc(100% - 96px)`
  - Prevents toolbar buttons from being hidden behind the FAB

- **Swipe-to-Expand**: New gesture support for toolbar expansion
  - Added touchmove listener with configurable thresholds (30px distance, 300ms time)
  - Swipe up on toolbar to expand and show multiple rows
  - Adds `.is-expanded` class with flex-wrap for multi-row display
  - Prevents default scrolling behavior during gesture
  - Includes haptic feedback on expansion

#### Mobile Search Optimization

- **Performance Improvements**: File list updates only when drawer is open or focused
  - Added file system event listeners (create, delete, rename, modify)
  - Smart update logic prevents unnecessary updates when view is hidden
  - View state tracking via IntersectionObserver (>50% visibility threshold)
  - Focus/blur events track when search input is active
  - Reduces battery usage and CPU overhead on mobile devices

### Fixed

- Toolbar now properly respects command availability context
- All command names follow sentence case convention (first word capitalized only)
- ESLint configuration enhanced with `@typescript-eslint/no-explicit-any` enforcement
- npm install peer dependency conflicts resolved
  - Unified @typescript-eslint packages to version 5.62.0
  - Removed conflicting package versions

### Code Quality

- Removed all `console.log()` statements, replaced with `console.debug()`
- Removed unused variables (`selection`, `isSingleLine`)
- Installed and configured `eslint-plugin-obsidianmd` for Obsidian-specific linting
- All commands now include appropriate Lucide icons for better UX
- Extracted magic numbers as named constants for maintainability

## [1.0.8] - 2025-11-28

- added recording features that cna be linked with PureChatLLM

## [1.0.7] - 2025-11-27

### Fixed

- mobile-toolbar interfearing with the built in toolbar
- Better file context menu supporting new items on("file-menu)

## [1.0.6] - 2025-11-27

### Added

- **Mobile Search**: A new dedicated search view optimized for mobile devices.
  - Sticky search input field that stays at the top.
  - Infinite scrolling for search results (10 initial results, loads 50 more per batch).
  - File previews with caching for better performance.
  - Date display at the bottom corner of each preview (relative time like "Today", "Yesterday", or formatted date).
  - File context menu on long-press/right-click with options: Open in new tab, Open to the right, Delete, Copy file path.
  - Smart keyboard handling (dismisses on scroll).
  - Auto-focus when sidebar opens.
  - Shows all files sorted by modification time when no query is entered.

## [1.0.5] - 2025-11-27

### Added

- **Settings**: Toggle visibility for Floating Action Button (FAB) and Toolbars.
- **FAB**: Configurable actions for press and long-press events.

### Changed

- **Refactor**: Migrated FAB command settings to a new event-driven system.
- **Refactor**: Extracted gesture handling logic for better maintainability.
- **Styles**: Updated toolbar class names and added transitions.

## [1.0.4] - 2025-11-27

### Added

- **Tablet Mode**: New feature to force tablet UI on phones.
- Command: `Toggle Keep in tablet mode`.
- Automated code formatting with Prettier during build process.

## [1.0.3] - 2025-11-27

### Fixed

- Addressed all ESLint and code quality issues from automated plugin review.
- Improved code formatting and configuration.
- Performance and correctness improvements based on code review.

## [1.0.2] - 2025-11-27

### Fixed

- Resolved description mismatch issues.

## [1.0.1] - 2025-11-27

### Fixed

- Fixed plugin ID and description mismatch in manifest.

## [1.0.0] - 2024-11-27

### Added

#### Floating Action Button (FAB)

- Leaf-anchored FAB that stays within the editor container
- **Tap** action creates new note with auto-increment naming (Untitled.md, Untitled 1.md, etc.)
- **Long-press** (≥500ms) opens the command palette
- Haptic feedback on tap (10ms) and long-press (20ms)
- Auto-focus on editor after note creation
- Configurable home folder for new notes
- FolderSuggest modal for folder selection with fuzzy search

#### Gesture Support

- **Draw gestures** by dragging from the FAB to execute commands
- Custom gesture recognition system with pattern matching
- Visual feedback showing the drawn gesture path
- Assign any Obsidian command to a custom gesture
- Gesture patterns are normalized and resampled for accurate matching
- Modal prompt for assigning commands to new unrecognized gestures
- Optional confirmation dialog (can be skipped for faster workflow)
- Gestures persist across sessions

#### Context-Aware Toolbar

- Dynamic toolbar that adapts based on cursor position and selection
- 9 context types supported:
  - **Selection** - When text is selected
  - **List** - Inside bullet or ordered lists
  - **Task** - Inside task list items
  - **Heading** - On heading lines
  - **Code Block** - Inside code blocks
  - **Table** - Inside tables
  - **Blockquote** - Inside blockquotes
  - **Link** - On links
  - **Default** - Fallback when no specific context matches
- Two-section settings architecture:
  - **Toolbar Library** - Define reusable toolbars with custom commands
  - **Context Bindings** - Bind toolbars to contexts
- Auto-concatenation when multiple toolbars match the same context
- Icon support with Obsidian's built-in icons (Lucide)
- Custom icon override per command
- Toggle between icon and text display
- Horizontal scrolling for toolbars with many buttons
- Editor focus preservation after button press

#### Commands

- `Create new note` - Creates note in configured home folder
- `Toggle Wake Lock` - Keeps screen awake during editing

#### Haptic Feedback

- Toggle setting to enable/disable
- 10ms vibration on FAB tap and toolbar button clicks
- 20ms vibration on FAB long-press
- Automatic device support detection

#### Wake Lock

- Toggle command to keep screen awake
- Status bar indicator shows "🔒 Wake Lock Active" when enabled
- Automatic release on plugin unload
- Uses Web Wake Lock API

### Technical Details

- Uses CodeMirror 6 ViewPlugin for toolbar implementation
- Uses `syntaxTree.iterate()` for context detection
- Supports HyperMD list line class names at any nesting depth
- Defers layout reads with `requestAnimationFrame` to avoid CodeMirror update errors
- Anchors toolbar to workspace-leaf-content container (fixes table cell rendering issue)

### Fixed

- Toolbar no longer renders inside table cells
- Editor no longer loses focus when toolbar buttons are pressed
- Infinite toolbar element creation bug resolved
- FAB visibility on editor leaf changes

---
