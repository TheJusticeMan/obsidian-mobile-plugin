# Changelog

All notable changes to the Mobile UX plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [Unreleased]

### Planned
- Additional context types
- Toolbar themes
- Gesture support
- Quick actions menu
