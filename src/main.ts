import { Platform, Plugin, Notice, Component, App } from 'obsidian';
import { FABManager } from './fab';
import {
  DEFAULT_SETTINGS,
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
      callback: () => this.pluspress(),
    });

    this.addCommand({
      id: 'plus-longpress',
      name: 'Plus long press',
      callback: () => this.plusLongpress(),
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
      name: 'Toggle Keep in tablet mode',
      callback: () => {
        if (this.kkep.isloaded) {
          this.removeChild(this.kkep);
          console.log('Keep in tablet mode disabled', this.kkep);
        } else {
          this.addChild(this.kkep);
          console.log('Keep in tablet mode enabled', this.kkep);
        }
      },
    });

    // Initialize FAB Manager
    this.fabManager = new FABManager(this.app, this);

    // Register the CodeMirror 6 toolbar extension with multiple context-aware toolbars
    this.registerEditorExtension(createToolbarExtension(this.app, this));
    // add ribbon icon
    this.addRibbonIcon('plus', 'Create new note', () => this.createNewNote());

    // Add settings tab
    this.addSettingTab(new MobileSettingTab(this.app, this));
  }

  createNewNote(): void {
    // Using the internal commands API to execute file creation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Obsidian's commands API is not typed
    (this.app as any).commands.executeCommandById('file-explorer:new-file');
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

  plusLongpress(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Obsidian's commands API is not typed
    (this.app as any).commands.executeCommandById(
      this.settings.plusLongpress || 'command-palette:open',
    );
  }

  pluspress(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Obsidian's commands API is not typed
    (this.app as any).commands.executeCommandById(
      this.settings.pluspress || 'file-explorer:new-file',
    );
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
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

export class keepInTabletMode extends Component {
  isloaded: boolean = false;
  wasPhone: boolean = false;
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
    console.log('Resized to tablet');
    Platform.isPhone = false;
    Platform.isTablet = true;
    document.body.toggleClass('is-tablet', Platform.isTablet);
    document.body.toggleClass('is-phone', Platform.isPhone);
  }

  private resetToPhoneMode() {
    console.log('Resized to phone');
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
