import { EditorView } from '@codemirror/view';
import {
  App,
  Editor,
  MarkdownView,
  Notice,
  Platform,
  Plugin,
  WorkspaceLeaf,
} from 'obsidian';
import { FABManager } from './features/fab';
import { keepInTabletMode } from './features/tablet-mode';
import { SearchLeaf, VIEW_TYPE_SEARCH } from './views/SearchLeaf';
import { updateMobileTabGestures } from './features/tab-gestures';
import {
  DEFAULT_SETTINGS,
  MobileCMDEvent,
  MobilePluginSettings,
  MobileSettingTab,
  settingsLeaf,
  settingsModel,
  VIEW_TYPE_SETTINGS,
} from './settings';
import { SwipePastSideSplit } from './features/sidebar-swipe';
import { TabsLeaf, VIEW_TYPE_TABS } from './views/TabsLeaf';
import { createToolbarExtension } from './features/toolbar';
import { registerCursorCommands } from './features/cursor-commands';

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
  elementsToCleanup: Map<HTMLElement, () => void> = new Map();
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

    this.kkep = new keepInTabletMode(this.app);

    // Initialize FAB Manager
    this.fabManager = new FABManager(this.app, this);

    // Register the Mobile Search view
    this.registerView(VIEW_TYPE_SEARCH, leaf => new SearchLeaf(leaf, this));

    // Register the Tabs view
    this.registerView(VIEW_TYPE_TABS, leaf => new TabsLeaf(leaf));

    // Register the settings tab
    this.registerView(VIEW_TYPE_SETTINGS, leaf => new settingsLeaf(leaf, this));

    // Register the CodeMirror 6 toolbar extension with multiple context-aware toolbars
    this.registerEditorExtension(createToolbarExtension(this.app, this));
    // add ribbon icon
    this.addRibbonIcon('plus', 'Create new note', this.createNewNote);
    this.addRibbonIcon('search', 'Open search', this.activateMobileSearchView);
    this.addRibbonIcon('tabs', 'Open tabs', this.activateTabsView);

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

    this.addChild(new SwipePastSideSplit(this.app));

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
      callback: this.activateTabsView,
    });

    this.addCommand({
      id: 'toggle-wake-lock',
      name: 'Toggle wake lock',
      callback: this.toggleWakeLock,
    });

    this.addCommand({
      id: 'settings',
      name: 'Settings',
      icon: 'settings',
      callback: () => new settingsModel(this.app, this).open(),
    });

    this.addCommand({
      id: 'settings-view',
      name: 'Open settings editor view',
      icon: 'settings',
      callback: async () =>
        await this.activatearbitraryView(VIEW_TYPE_SETTINGS),
    });

    this.addCommand({
      id: 'keep-in-tablet-mode',
      name: 'Toggle keep in tablet mode',
      icon: 'tablet-smartphone',
      callback: () =>
        this.kkep.isloaded
          ? this.removeChild(this.kkep)
          : this.addChild(this.kkep),
    });

    if (this.app.emulateMobile)
      this.addCommand({
        id: 'toggle-emulate-phone-mode',
        name: 'Toggle emulate phone mode',
        icon: 'smartphone',
        callback: () => {
          this.app.emulateMobile(!Platform.isMobile);
        },
      });

    registerCursorCommands(this);

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
      callback: this.activateMobileSearchView,
    });
  }

  /**
   * Activates the Mobile Search view in the left sidebar.
   */
  activateMobileSearchView = () =>
    void this.activatearbitraryView(VIEW_TYPE_SEARCH, 'left');

  activateTabsView = () =>
    void this.activatearbitraryView(VIEW_TYPE_TABS, 'right');

  async activatearbitraryView(
    viewType: string,
    position: 'right' | 'left' | '' = '',
  ): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(viewType)[0];

    if (!leaf) {
      const targetLeaf =
        position === 'right'
          ? workspace.getRightLeaf(false)
          : position === 'left'
            ? workspace.getLeftLeaf(false)
            : workspace.getLeaf(false);
      if (targetLeaf) {
        void targetLeaf.setViewState({
          type: viewType,
          active: true,
        });
        leaf = targetLeaf;
      }
    }

    if (leaf) {
      await workspace.revealLeaf(leaf);
    }
  }

  // Using the internal commands API to execute file creation
  createNewNote = (): void => {
    this.app.commands?.executeCommandById('file-explorer:new-file');
  };

  getBinds(toolbarId: string): string[] {
    const binds: string[] = [];
    for (const binding of this.settings.contextBindings) {
      if (binding.toolbarId === toolbarId) binds.push(binding.contextType);
    }
    return binds;
  }

  triggerCMDEvent(eventType: MobileCMDEvent): void {
    const cmdId = this.settings.MobileCMDEvents[eventType];

    this.app.commands?.executeCommandById(cmdId);
  }

  toggleWakeLock = async (): Promise<void> => {
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
  };

  hapticFeedback(duration = 10): boolean {
    return (
      this.settings.enableHapticFeedback &&
      navigator.vibrate &&
      navigator.vibrate(duration)
    );
  }

  onUserEnable() {
    this.activateMobileSearchView();
    this.activateTabsView();
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
