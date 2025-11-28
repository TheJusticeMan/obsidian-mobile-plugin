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
    if (!Platform.isMobile) {
      return;
    }

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
      id: 'plus-press',
      name: 'Plus press',
      callback: () => this.triggerCMDEvent('fab-press'),
    });

    this.addCommand({
      id: 'plus-longpress',
      name: 'Plus long press',
      callback: () => this.triggerCMDEvent('fab-longpress'),
    });

    this.addCommand({
      id: 'mobile-settings',
      name: 'Open settings',
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
            new Notice('FAB recording mode disabled');
          } else {
            this.fabManager?.setMode('recording');
            new Notice('FAB recording mode enabled');
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
              console.log(view);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Obsidian's commands API is not typed
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

    // Detach Mobile Search leaves
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_MOBILE_SEARCH);
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
