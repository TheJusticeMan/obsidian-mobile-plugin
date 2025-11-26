import { Notice, Plugin, TFile, normalizePath } from "obsidian";
import { FABManager } from "./fab";
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

    // Register command for creating new notes
    this.addCommand({
      id: "create-new-note",
      name: "Create new note",
      callback: async () => {
        await this.createNewNote();
      },
    });

    // Register wake lock toggle command
    this.addCommand({
      id: "toggle-wake-lock",
      name: "Toggle Wake Lock",
      callback: async () => {
        await this.toggleWakeLock();
      },
    });

    // Initialize FAB Manager
    this.fabManager = new FABManager(this.app,  this);

    // Register the CodeMirror 6 toolbar extension with multiple context-aware toolbars
    this.registerEditorExtension(
      createToolbarExtension(this.app, this.settings)
    );

    // Add settings tab
    this.addSettingTab(new MobileSettingTab(this.app, this));
  }

  refreshToolbar() {
    // Trigger a workspace update to refresh the toolbar
    // The toolbar will re-render with updated settings on the next selection change
    this.app.workspace.trigger("active-leaf-change");
  }

  async createNewNote() {
    try {
      // Determine the folder path
      const folderPath = this.settings.homeFolder
        ? normalizePath(this.settings.homeFolder)
        : "";

      // Ensure the folder exists
      if (folderPath && !(await this.app.vault.adapter.exists(folderPath))) {
        await this.app.vault.createFolder(folderPath);
      }

      // Find an available filename
      let filename = "Untitled.md";
      let counter = 1;
      let fullPath = folderPath ? `${folderPath}/Untitled.md` : "Untitled.md";

      while (await this.app.vault.adapter.exists(fullPath)) {
        filename = `Untitled ${counter}.md`;
        fullPath = folderPath ? `${folderPath}/${filename}` : filename;
        counter++;
      }

      // Create the file
      const file = await this.app.vault.create(fullPath, "");

      // Open the newly created file
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file as TFile);

      // Auto-focus into the editor
      setTimeout(() => {
        this.app.workspace.activeEditor?.editor?.focus();
      }, 100);
    } catch (error) {
      console.error("Error creating note:", error);
    }
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
