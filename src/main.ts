import {
  App,
  Component,
  Editor,
  MarkdownView,
  Notice,
  Platform,
  Plugin,
  WorkspaceLeaf,
} from 'obsidian';
import { FABManager } from './fab';
import { SearchLeaf, VIEW_TYPE_SEARCH } from './MobileSearchLeaf';
import { updateMobileTabGestures } from './MobileTabGestures';
import {
  DEFAULT_SETTINGS,
  MobileCMDEvent,
  MobilePluginSettings,
  MobileSettingTab,
  mySettingsModel,
} from './settings';
import { TabsLeaf, VIEW_TYPE_TABS } from './TabsLeaf';
import { createToolbarExtension } from './toolbar-extension';
import { EditorView } from '@codemirror/view';

// WakeLock API types (not in standard TS lib)
interface WakeLockSentinel {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

interface WakeLockNavigator {
  wakeLock?: {
    request: (type: string) => Promise<WakeLockSentinel>;
  };
}

/**
 * Main plugin class for the Obsidian Mobile Plugin.
 *
 * Provides mobile-optimized UX enhancements including:
 * - Floating action button (FAB) for quick actions
 * - Context-aware toolbars for editing
 * - Tab gesture support
 * - Wake lock functionality
 * - Custom commands for mobile navigation and selection
 *
 * @extends Plugin
 */
export default class MobilePlugin extends Plugin {
  settings: MobilePluginSettings;
  fabManager: FABManager | null = null;
  wakeLock: WakeLockSentinel | null = null;
  kkep: keepInTabletMode;
  isTabSwitcherOpened: boolean = false;
  leafDragging: WorkspaceLeaf | null = null;
  app: App;
  // Map to track toolbar elements by active editor (Editor)
  toolbarMap: WeakMap<Editor, { el: HTMLElement; view: EditorView }> =
    new WeakMap();

  async onload() {
    await this.loadSettings();

    document.body.toggleClass(
      'hidden-mobile-toolbar',
      !this.settings.showBuiltInToolbar,
    );

    // Register wake lock toggle command
    this.registerCommands();

    this.kkep = new keepInTabletMode(this.app, this);

    // Initialize FAB Manager
    this.fabManager = new FABManager(this.app, this);

    // Register the Mobile Search view
    this.registerView(VIEW_TYPE_SEARCH, leaf => new SearchLeaf(leaf, this));

    // Register the Tabs view
    this.registerView(VIEW_TYPE_TABS, leaf => new TabsLeaf(leaf));

    // Register the CodeMirror 6 toolbar extension with multiple context-aware toolbars
    this.registerEditorExtension(createToolbarExtension(this.app, this));
    // add ribbon icon
    this.addRibbonIcon('plus', 'Create new note', () => this.createNewNote());
    this.addRibbonIcon('search', 'Open search', () => {
      void this.activateMobileSearchView();
    });

    this.app.workspace.onLayoutReady(() => {
      this.registerInterval(
        window.setInterval(() => {
          const isopen =
            this.app.mobileTabSwitcher?.containerEl?.parentNode != null;
          if (!isopen) {
            this.isTabSwitcherOpened = false;
            return;
          }
          if (isopen && !this.isTabSwitcherOpened) {
            updateMobileTabGestures(this);
            this.isTabSwitcherOpened = true;
          }
        }, 100),
      );
    });

    this.app.workspace.on('layout-change', () => {
      updateMobileTabGestures(this);
    });

    // Add settings tab
    this.addSettingTab(new MobileSettingTab(this.app, this));
  }

  private registerCommands() {
    this.addCommand({
      id: 'open-tabs',
      name: 'Open tabs',
      icon: 'tabs',
      callback: () => {
        void this.activateTabsView();
      },
    });

    this.addCommand({
      id: 'toggle-wake-lock',
      name: 'Toggle wake lock',
      callback: async () => {
        await this.toggleWakeLock();
      },
    });

    this.addCommand({
      id: 'settings',
      name: 'Settings',
      icon: 'settings',
      callback: () => {
        new mySettingsModel(this.app, this).open();
      },
    });

    this.addCommand({
      id: 'keep-in-tablet-mode',
      name: 'Toggle keep in tablet mode',
      icon: 'tablet-smartphone',
      callback: () => {
        if (this.kkep.isloaded) {
          this.removeChild(this.kkep);
        } else {
          this.addChild(this.kkep);
        }
      },
    });

    // Navigation commands
    this.addCommand({
      id: 'cursor-up',
      name: 'Up',
      icon: 'arrow-up',
      editorCallback: editor => {
        const cursor = editor.getCursor();
        if (cursor.line > 0) {
          editor.setCursor({ line: cursor.line - 1, ch: cursor.ch });
        }
      },
    });

    this.addCommand({
      id: 'cursor-down',
      name: 'Down',
      icon: 'arrow-down',
      editorCallback: editor => {
        const cursor = editor.getCursor();
        const lastLine = editor.lastLine();
        if (cursor.line < lastLine) {
          editor.setCursor({ line: cursor.line + 1, ch: cursor.ch });
        }
      },
    });

    this.addCommand({
      id: 'cursor-left',
      name: 'Left',
      icon: 'arrow-left',
      editorCallback: editor => {
        const cursor = editor.getCursor();
        if (cursor.ch > 0) {
          editor.setCursor({ line: cursor.line, ch: cursor.ch - 1 });
        } else if (cursor.line > 0) {
          // Move to end of previous line
          const prevLine = editor.getLine(cursor.line - 1);
          editor.setCursor({ line: cursor.line - 1, ch: prevLine.length });
        }
      },
    });

    this.addCommand({
      id: 'cursor-right',
      name: 'Right',
      icon: 'arrow-right',
      editorCallback: editor => {
        const cursor = editor.getCursor();
        const currentLine = editor.getLine(cursor.line);
        if (cursor.ch < currentLine.length) {
          editor.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
        } else if (cursor.line < editor.lastLine()) {
          // Move to start of next line
          editor.setCursor({ line: cursor.line + 1, ch: 0 });
        }
      },
    });

    // Selection expansion commands (Plus)
    this.addCommand({
      id: 'select-plus-bottom',
      name: 'Expand down',
      icon: 'chevrons-down',
      editorCallback: editor => {
        const cursor = editor.getCursor('to');
        const currentLine = editor.getLine(cursor.line);

        // Find next word boundary or line end
        let nextPos = cursor.ch;
        const text = currentLine.slice(cursor.ch);

        // Skip current word characters
        const wordMatch = text.match(/^\w+/);
        if (wordMatch) {
          nextPos += wordMatch[0].length;
        } else {
          // Skip non-word characters to next word or end
          const nonWordMatch = text.match(/^\W+/);
          if (nonWordMatch) {
            nextPos += nonWordMatch[0].length;
          } else {
            nextPos = currentLine.length;
          }
        }

        // Set selection from current anchor to new position
        const from = editor.getCursor('from');
        editor.setSelection(from, { line: cursor.line, ch: nextPos });
      },
    });

    this.addCommand({
      id: 'select-plus-top',
      name: 'Expand up',
      icon: 'chevrons-up',
      editorCallback: editor => {
        const cursor = editor.getCursor('from');
        const currentLine = editor.getLine(cursor.line);

        // Find previous word boundary
        let prevPos = cursor.ch;
        const text = currentLine.slice(0, cursor.ch);

        // Skip backwards to find word boundary
        if (prevPos > 0) {
          // Reverse the string and find word boundary
          const reversed = text.split('').reverse().join('');
          const wordMatch = reversed.match(/^\w+/);
          if (wordMatch) {
            prevPos -= wordMatch[0].length;
          } else {
            const nonWordMatch = reversed.match(/^\W+/);
            if (nonWordMatch) {
              prevPos -= nonWordMatch[0].length;
            } else {
              prevPos = 0;
            }
          }
        }

        // Set selection from new position to current end
        const to = editor.getCursor('to');
        editor.setSelection({ line: cursor.line, ch: prevPos }, to);
      },
    });

    // Selection contraction commands (Minus)
    this.addCommand({
      id: 'select-minus-bottom',
      name: 'Shrink down',
      icon: 'chevron-down',
      editorCallback: editor => {
        const from = editor.getCursor('from');
        const to = editor.getCursor('to');

        if (from.line === to.line && from.ch === to.ch) {
          // No selection, do nothing
          return;
        }

        // Shrink from the end by one character
        let newTo = { line: to.line, ch: to.ch - 1 };

        // If at start of line, move to previous line end
        if (to.ch === 0 && to.line > from.line) {
          const prevLine = editor.getLine(to.line - 1);
          newTo = { line: to.line - 1, ch: prevLine.length };
        }

        // Ensure we don't go past the from position
        if (
          newTo.line < from.line ||
          (newTo.line === from.line && newTo.ch < from.ch)
        ) {
          newTo = from;
        }

        editor.setSelection(from, newTo);
      },
    });

    this.addCommand({
      id: 'select-minus-top',
      name: 'Shrink up',
      icon: 'chevron-up',
      editorCallback: editor => {
        const from = editor.getCursor('from');
        const to = editor.getCursor('to');

        if (from.line === to.line && from.ch === to.ch) {
          // No selection, do nothing
          return;
        }

        // Shrink from the start by one character
        let newFrom = { line: from.line, ch: from.ch + 1 };
        const currentLine = editor.getLine(from.line);

        // If at end of line, move to next line start
        if (from.ch >= currentLine.length && from.line < to.line) {
          newFrom = { line: from.line + 1, ch: 0 };
        }

        // Ensure we don't go past the to position
        if (
          newFrom.line > to.line ||
          (newFrom.line === to.line && newFrom.ch > to.ch)
        ) {
          newFrom = to;
        }

        editor.setSelection(newFrom, to);
      },
    });

    // Selection commands
    this.addCommand({
      id: 'select-word',
      name: 'Select word',
      icon: 'text-cursor',
      editorCallback: editor => {
        const cursor = editor.getCursor();
        const currentLine = editor.getLine(cursor.line);

        // If cursor is not on a word character, find the next word
        let cursorPos = cursor.ch;
        if (
          cursorPos < currentLine.length &&
          !/\w/.test(currentLine[cursorPos])
        ) {
          // Skip non-word characters to find next word
          while (
            cursorPos < currentLine.length &&
            !/\w/.test(currentLine[cursorPos])
          ) {
            cursorPos++;
          }
        }

        // Find word boundaries around cursor/next word
        let start = cursorPos;
        let end = cursorPos;

        // Move start backward to word boundary
        while (start > 0 && /\w/.test(currentLine[start - 1])) {
          start--;
        }

        // Move end forward to word boundary
        while (end < currentLine.length && /\w/.test(currentLine[end])) {
          end++;
        }

        // Select the word
        editor.setSelection(
          { line: cursor.line, ch: start },
          { line: cursor.line, ch: end },
        );
      },
    });

    this.addCommand({
      id: 'select-sentence',
      name: 'Select sentence',
      icon: 'type',
      editorCallback: editor => {
        const cursor = editor.getCursor();
        const text = editor.getValue();
        const offset = editor.posToOffset(cursor);

        // Find sentence boundaries (. ! ?) followed by space or newline
        let start = 0;
        let end = text.length;

        // Find start of sentence (after previous sentence ending or start of text)
        for (let i = offset - 1; i >= 0; i--) {
          if (
            (text[i] === '.' || text[i] === '!' || text[i] === '?') &&
            (text[i + 1] === ' ' || text[i + 1] === '\n' || i === offset - 1)
          ) {
            start = i + 1;
            // Skip whitespace after punctuation
            while (
              start < text.length &&
              (text[start] === ' ' || text[start] === '\n')
            ) {
              start++;
            }
            break;
          }
        }

        // Find end of sentence (next sentence ending)
        for (let i = offset; i < text.length; i++) {
          if (
            (text[i] === '.' || text[i] === '!' || text[i] === '?') &&
            (i === text.length - 1 ||
              text[i + 1] === ' ' ||
              text[i + 1] === '\n')
          ) {
            end = i + 1;
            break;
          }
        }

        // Convert offsets to positions
        const startPos = editor.offsetToPos(start);
        const endPos = editor.offsetToPos(end);

        editor.setSelection(startPos, endPos);
      },
    });

    this.addCommand({
      id: 'select-line',
      name: 'Select line',
      icon: 'minus',
      editorCallback: editor => {
        const cursor = editor.getCursor();
        const lastLine = editor.lastLine();

        // Select entire line including newline if not last line
        if (cursor.line < lastLine) {
          editor.setSelection(
            { line: cursor.line, ch: 0 },
            { line: cursor.line + 1, ch: 0 },
          );
        } else {
          // Last line - select to end of line
          const currentLine = editor.getLine(cursor.line);
          editor.setSelection(
            { line: cursor.line, ch: 0 },
            { line: cursor.line, ch: currentLine.length },
          );
        }
      },
    });

    this.addCommand({
      id: 'select-all',
      name: 'Select all',
      icon: 'file-text',
      editorCallback: editor => {
        const lastLine = editor.lastLine();
        const lastLineText = editor.getLine(lastLine);

        // Select from start to end of document
        editor.setSelection(
          { line: 0, ch: 0 },
          { line: lastLine, ch: lastLineText.length },
        );
      },
    });

    // Progressive selection command
    this.addCommand({
      id: 'select-more',
      name: 'Select more',
      icon: 'maximize-2',
      editorCallback: editor => {
        const from = editor.getCursor('from');
        const to = editor.getCursor('to');
        const hasSelection = !(from.line === to.line && from.ch === to.ch);

        if (!hasSelection) {
          // No selection - select word
          const cursor = editor.getCursor();
          const currentLine = editor.getLine(cursor.line);

          let cursorPos = cursor.ch;
          if (
            cursorPos < currentLine.length &&
            !/\w/.test(currentLine[cursorPos])
          ) {
            while (
              cursorPos < currentLine.length &&
              !/\w/.test(currentLine[cursorPos])
            ) {
              cursorPos++;
            }
          }

          let start = cursorPos;
          let end = cursorPos;

          while (start > 0 && /\w/.test(currentLine[start - 1])) {
            start--;
          }
          while (end < currentLine.length && /\w/.test(currentLine[end])) {
            end++;
          }

          editor.setSelection(
            { line: cursor.line, ch: start },
            { line: cursor.line, ch: end },
          );
          return;
        }

        // Check if current selection is a word
        const selectedText = editor.getSelection();
        const isWord =
          from.line === to.line &&
          selectedText.trim().length > 0 &&
          !selectedText.includes('\n') &&
          /^\w+$/.test(selectedText.trim());

        if (isWord) {
          // Word selected - select sentence
          const text = editor.getValue();
          const offset = editor.posToOffset(from);

          let start = 0;
          let end = text.length;

          for (let i = offset - 1; i >= 0; i--) {
            if (
              (text[i] === '.' || text[i] === '!' || text[i] === '?') &&
              (text[i + 1] === ' ' || text[i + 1] === '\n' || i === offset - 1)
            ) {
              start = i + 1;
              while (
                start < text.length &&
                (text[start] === ' ' || text[start] === '\n')
              ) {
                start++;
              }
              break;
            }
          }

          const toOffset = editor.posToOffset(to);
          for (let i = toOffset; i < text.length; i++) {
            if (
              (text[i] === '.' || text[i] === '!' || text[i] === '?') &&
              (i === text.length - 1 ||
                text[i + 1] === ' ' ||
                text[i + 1] === '\n')
            ) {
              end = i + 1;
              break;
            }
          }

          const startPos = editor.offsetToPos(start);
          const endPos = editor.offsetToPos(end);
          editor.setSelection(startPos, endPos);
          return;
        }

        // Check if current selection is a sentence or less than a line
        const currentLine = editor.getLine(from.line);
        const isFullLine =
          from.ch === 0 &&
          ((from.line < editor.lastLine() &&
            to.line === from.line + 1 &&
            to.ch === 0) ||
            (from.line === editor.lastLine() && to.ch === currentLine.length));

        if (!isFullLine) {
          // Not a full line - select whole line
          const lastLine = editor.lastLine();
          if (from.line < lastLine) {
            editor.setSelection(
              { line: from.line, ch: 0 },
              { line: from.line + 1, ch: 0 },
            );
          } else {
            editor.setSelection(
              { line: from.line, ch: 0 },
              { line: from.line, ch: currentLine.length },
            );
          }
          return;
        }

        // Line selected - select all
        const lastLine = editor.lastLine();
        const lastLineText = editor.getLine(lastLine);
        editor.setSelection(
          { line: 0, ch: 0 },
          { line: lastLine, ch: lastLineText.length },
        );
      },
    });

    // if there is PureChutLLM plugin, and a recorder command, add a command to trigger it
    const hasAudioRecorder =
      this.app.commands?.commands['audio-recorder:start'] &&
      this.app.commands?.commands['audio-recorder:stop'];
    const hasPureChatLLM =
      this.app.commands?.commands['pure-chat-llm:complete-chat-response'];
    if (hasAudioRecorder && hasPureChatLLM) {
      this.addCommand({
        id: 'quick-audio-notes',
        name: 'Quick audio notes',
        icon: 'microphone',
        callback: () => {
          // Toggle FAB record mode
          if (this.fabManager?.getMode() === 'recording') {
            this.fabManager?.setMode('default');
            new Notice('Recording mode disabled');
          } else {
            this.fabManager?.setMode('recording');
            new Notice('Recording mode enabled');
          }
        },
      });
      this.addCommand({
        id: 'end-recording-and-transcribe',
        name: 'End recording and transcribe',
        icon: 'microphone-off',
        callback: () => {
          this.app.commands?.executeCommandById('file-explorer:new-file');

          const end = () => {
            // First stop the recording
            this.app.commands?.executeCommandById('audio-recorder:stop');
            // Then trigger PureChatLLM transcription
            // move the cursor into the new note after a short delay
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);

            setTimeout(() => {
              if (view) {
                view.editor.focus();
                view.editor.setValue(
                  `\n# role: User\nTranscribe the content of this audio file into a structured markdown note\n${view.editor.getValue()}\n`,
                );
              }
              this.app.commands?.executeCommandById(
                'pure-chat-llm:complete-chat-response',
              );
            }, 500);
            this.app.workspace.off('active-leaf-change', end);
          };
          this.app.workspace.on('active-leaf-change', end);
        },
      });
    }

    // Add command to open Mobile Search
    this.addCommand({
      id: 'open-search',
      name: 'Open search',
      icon: 'search',
      callback: () => {
        void this.activateMobileSearchView();
      },
    });
  }

  /**
   * Activates the Mobile Search view in the left sidebar.
   */
  async activateMobileSearchView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_SEARCH)[0];

    if (!leaf) {
      // Create the view in the left sidebar
      const leftLeaf = workspace.getLeftLeaf(false);
      if (leftLeaf) {
        await leftLeaf.setViewState({
          type: VIEW_TYPE_SEARCH,
          active: true,
        });
        leaf = leftLeaf;
      }
    }

    if (leaf) {
      void workspace.revealLeaf(leaf);
    }
  }

  activateTabsView(): void {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_TABS)[0];

    if (!leaf) {
      // Create the view in the left sidebar
      const leftLeaf = workspace.getRightLeaf(false);
      if (leftLeaf) {
        void leftLeaf.setViewState({
          type: VIEW_TYPE_TABS,
          active: true,
        });
        leaf = leftLeaf;
      }
    }

    if (leaf) {
      void workspace.revealLeaf(leaf);
    }
  }

  createNewNote(): void {
    // Using the internal commands API to execute file creation
    this.app.commands?.executeCommandById('file-explorer:new-file');
  }

  getBinds(toolbarId: string): string[] {
    const binds: string[] = [];
    for (const binding of this.settings.contextBindings) {
      if (binding.toolbarId === toolbarId) {
        binds.push(binding.contextType);
      }
    }
    return binds;
  }

  triggerCMDEvent(eventType: MobileCMDEvent): void {
    const cmdId = this.settings.MobileCMDEvents[eventType];

    this.app.commands?.executeCommandById(cmdId);
  }

  async toggleWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator)) {
      // Wake Lock API not supported
      return;
    }

    try {
      if (this.wakeLock) {
        // Release wake lock
        await this.wakeLock.release();
        this.wakeLock = null;
      } else {
        // Request wake lock
        this.wakeLock =
          (await (navigator as WakeLockNavigator).wakeLock?.request(
            'screen',
          )) || null;

        // Listen for wake lock release
        this.wakeLock?.addEventListener('release', () => {
          this.wakeLock = null;
        });
      }
      new Notice(this.wakeLock ? 'Wake lock enabled' : 'Wake lock disabled');
    } catch (error) {
      console.error('Wake lock error:', error);
    }
  }

  onUserEnable() {
    void this.activateMobileSearchView();
    void this.activateTabsView();
  }

  onunload(): void {
    // Release wake lock if active
    if (this.wakeLock) {
      void this.wakeLock.release().then(() => {
        this.wakeLock = null;
      });
    }

    // Clean up FAB manager
    if (this.fabManager) {
      this.fabManager.destroy();
      this.fabManager = null;
    }
  }

  /**
   * Registers a DOM element to be removed when the plugin unloads.
   * Use this instead of pushing to domElementsToClean.
   */
  registerDomElement(el: HTMLElement) {
    this.register(() => el.remove());
  }

  async loadSettings() {
    const loadedData =
      (await this.loadData()) as Partial<MobilePluginSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData ?? {});
    if (this.settings.plusLongpress) {
      this.settings.MobileCMDEvents['fab-longpress'] =
        this.settings.plusLongpress;
      delete this.settings.plusLongpress;
    }
    if (this.settings.pluspress) {
      this.settings.MobileCMDEvents['fab-press'] = this.settings.pluspress;
      delete this.settings.pluspress;
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.fabManager?.refresh();
  }
}

/**
 * Component that forces tablet mode on phone devices.
 *
 * When loaded, this component overrides the phone detection and
 * sets the platform to tablet mode, providing a desktop-like experience
 * on mobile devices. The original state is restored when unloaded.
 *
 * @extends Component
 */
export class keepInTabletMode extends Component {
  isloaded = false;
  wasPhone = false;
  constructor(
    public app: App,
    public plugin: MobilePlugin,
  ) {
    super();
  }
  onload(): void {
    this.isloaded = true;
    this.wasPhone = Platform.isPhone;
    if (Platform.isPhone) {
      this.setTabletMode();
    }
    this.registerEvent(
      this.app.workspace.on('resize', () => {
        if (Platform.isPhone) {
          this.wasPhone = true;
          this.setTabletMode();
        }
      }),
    );
  }

  private setTabletMode() {
    Platform.isPhone = false;
    Platform.isTablet = true;
    document.body.toggleClass('is-tablet', Platform.isTablet);
    document.body.toggleClass('is-phone', Platform.isPhone);
  }

  private resetToPhoneMode() {
    Platform.isPhone = true;
    Platform.isTablet = false;
    document.body.toggleClass('is-tablet', Platform.isTablet);
    document.body.toggleClass('is-phone', Platform.isPhone);
  }

  onunload(): void {
    this.isloaded = false;
    if (this.wasPhone) this.resetToPhoneMode();
  }
}
