import {
  Platform,
  Plugin,
  Notice,
  Component,
  App,
  MarkdownView,
} from 'obsidian';
import { FABManager } from './fab';
import {
  MobileSearchLeaf,
  VIEW_TYPE_MOBILE_SEARCH,
} from './mobile-search-leaf';
import {
  DEFAULT_SETTINGS,
  MobileCMDEvent,
  MobilePluginSettings,
  MobileSettingTab,
  mySettingsModel,
} from './settings';
import { createToolbarExtension } from './toolbar-extension';

// WakeLock API types (not in standard TS lib)
interface WakeLockSentinel {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}
export interface CommandManager {
  commands: Record<string, unknown>;
  executeCommandById: (id: string) => void;
}

export default class MobilePlugin extends Plugin {
  settings: MobilePluginSettings;
  fabManager: FABManager | null = null;
  wakeLock: WakeLockSentinel | null = null;
  kkep: keepInTabletMode;

  async onload() {
    await this.loadSettings();

    // Register wake lock toggle command
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
    this.kkep = new keepInTabletMode(this.app, this);

    this.addCommand({
      id: 'keep-in-tablet-mode',
      name: 'Toggle keep in tablet mode',
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
      editorCallback: (editor) => {
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
      editorCallback: (editor) => {
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
      editorCallback: (editor) => {
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
      editorCallback: (editor) => {
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
      editorCallback: (editor) => {
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
      editorCallback: (editor) => {
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
      editorCallback: (editor) => {
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
      editorCallback: (editor) => {
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
      editorCallback: (editor) => {
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
      editorCallback: (editor) => {
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
      editorCallback: (editor) => {
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
      editorCallback: (editor) => {
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
      editorCallback: (editor) => {
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
      this.commandManager?.commands['audio-recorder:start'] &&
      this.commandManager?.commands['audio-recorder:stop'];
    const hasPureChatLLM =
      this.commandManager?.commands['pure-chat-llm:complete-chat-response'];
    if (hasAudioRecorder && hasPureChatLLM) {
      this.addCommand({
        id: 'quick-audio-notes',
        name: 'Quick audio notes',
        icon: 'microphone',
        callback: async () => {
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
        callback: async () => {
          this.commandManager?.executeCommandById('file-explorer:new-file');

          const end = () => {
            // First stop the recording
            this.commandManager?.executeCommandById('audio-recorder:stop');
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
              this.commandManager?.executeCommandById(
                'pure-chat-llm:complete-chat-response',
              );
            }, 500);
            this.app.workspace.off('active-leaf-change', end);
          };
          this.app.workspace.on('active-leaf-change', end);
        },
      });
    }

    // Initialize FAB Manager
    this.fabManager = new FABManager(this.app, this);

    // Register the Mobile Search view
    this.registerView(
      VIEW_TYPE_MOBILE_SEARCH,
      (leaf) => new MobileSearchLeaf(leaf),
    );

    // Add command to open Mobile Search
    this.addCommand({
      id: 'open-mobile-search',
      name: 'Open Mobile Search',
      icon: 'search',
      callback: () => {
        void this.activateMobileSearchView();
      },
    });

    // Register the CodeMirror 6 toolbar extension with multiple context-aware toolbars
    this.registerEditorExtension(createToolbarExtension(this.app, this));
    // add ribbon icon
    this.addRibbonIcon('plus', 'Create new note', () => this.createNewNote());
    this.addRibbonIcon('search', 'Open Mobile Search', () => {
      void this.activateMobileSearchView();
    });

    // Add settings tab
    this.addSettingTab(new MobileSettingTab(this.app, this));
  }

  get commandManager(): CommandManager | undefined {
    return (this.app as { commands?: CommandManager }).commands;
  }

  /**
   * Activates the Mobile Search view in the left sidebar.
   */
  async activateMobileSearchView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_MOBILE_SEARCH)[0];

    if (!leaf) {
      // Create the view in the left sidebar
      const leftLeaf = workspace.getLeftLeaf(false);
      if (leftLeaf) {
        await leftLeaf.setViewState({
          type: VIEW_TYPE_MOBILE_SEARCH,
          active: true,
        });
        leaf = leftLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  createNewNote(): void {
    // Using the internal commands API to execute file creation
    this.commandManager?.executeCommandById('file-explorer:new-file');
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

    this.commandManager?.executeCommandById(cmdId);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- WakeLock API is not in standard TS lib
        this.wakeLock = await (navigator as any).wakeLock.request('screen');

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
    this.activateMobileSearchView();
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

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
