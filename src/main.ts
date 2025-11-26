import { Notice, Plugin } from "obsidian";
import { FABManager, offset } from "./fab";
import {
  DEFAULT_SETTINGS,
  MobilePluginSettings,
  MobileSettingTab,
} from "./settings";
import { createToolbarExtension } from "./toolbar-extension";

export default class MobilePlugin extends Plugin {
  settings: MobilePluginSettings;
  fabManager: FABManager | null = null;
  wakeLock: any = null;

  async onload() {
    await this.loadSettings();

    // Register wake lock toggle command
    this.addCommand({
      id: "toggle-wake-lock",
      name: "Toggle Wake Lock",
      callback: async () => {
        await this.toggleWakeLock();
      },
    });

    // Initialize FAB Manager
    this.fabManager = new FABManager(this.app, this);

    // Register the CodeMirror 6 toolbar extension with multiple context-aware toolbars
    this.registerEditorExtension(createToolbarExtension(this.app, this));

    // add ribbon icon
    this.addRibbonIcon(
      "plus",
      "Create New Note",
      async () => await this.createNewNote()
    );

    // Add settings tab
    this.addSettingTab(new MobileSettingTab(this.app, this));
  }

  async createNewNote() {
    (this.app as any).commands.executeCommandById("file-explorer:new-file");
  }

  async toggleWakeLock() {
    if (!("wakeLock" in navigator)) {
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
        this.wakeLock = await (navigator as any).wakeLock.request("screen");

        // Listen for wake lock release
        this.wakeLock.addEventListener("release", () => {
          this.wakeLock = null;
        });
      }
      new Notice(this.wakeLock ? "Wake Lock Enabled" : "Wake Lock Disabled");
    } catch (error) {
      console.error("Wake lock error:", error);
    }
  }

  async onunload() {
    // Release wake lock if active
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
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
