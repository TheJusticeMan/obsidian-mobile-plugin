# Changelog

All notable changes to the Mobile UX plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Better integration with other plugins.
- Ask me for a feature to make it easyer to capture on the go

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
