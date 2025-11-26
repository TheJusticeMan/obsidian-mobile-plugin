import {
  App,
  ButtonComponent,
  MarkdownView,
  normalizePath,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import MobilePlugin from "./main";
import { MobilePluginSettings } from "./settings";

/**
 * Manages FAB placement and lifecycle across editor leaves.
 */
export class FABManager {
  private fabElements: Map<MarkdownView, HTMLElement> = new Map();

  constructor(private app: App, private plugin: MobilePlugin) {
    // Initial setup can be done here if needed
    // Update FAB when workspace layout changes
    this.plugin.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.updateActiveLeaf())
    );

    // Initial FAB setup
    this.app.workspace.onLayoutReady(() => this.updateActiveLeaf());
  }

  /**
   * Updates FAB for the active leaf
   */
  updateActiveLeaf() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      this.ensureFABForLeaf(activeView);
    }
  }

  /**
   * Ensures a FAB exists for the given leaf
   */
  private ensureFABForLeaf(view: MarkdownView) {
    // Check if this leaf is a markdown editor

    // Don't create duplicate FABs
    if (this.fabElements.has(view)) {
      return;
    }

    // Create and mount FAB
    const fab = this.createFAB(view.containerEl);
    view.containerEl.appendChild(fab);
    this.fabElements.set(view, fab);
  }

  /**
   * Creates a FAB element
   */
  private createFAB(containerEl: HTMLElement): HTMLElement {
    // Change to new ButtonComponent style

    return new ButtonComponent(containerEl)
      .setTooltip("Create new note (long press for command palette)")
      .setIcon("plus")
      .setClass("mobile-fab")
      .onClick(async () => {
        this.hapticFeedback(10);
        await this.createNewNote();
      })
      .then((btn) =>
        btn.buttonEl.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          this.hapticFeedback(20);
          // Open command palette
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this.app as any).commands?.executeCommandById(
            "command-palette:open"
          );
        })
      ).buttonEl;

    // Alternatively, create FAB manually
    const fab = document.createElement("button");
    fab.className = "mobile-fab";
    fab.setAttribute(
      "aria-label",
      "Create new note (long press for command palette)"
    );

    // Add plus icon
    fab.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

    // Variables for long press detection
    let pressTimer: NodeJS.Timeout | null = null;
    let isLongPress = false;

    // Touch/Mouse start
    const startPress = () => {
      isLongPress = false;
      pressTimer = setTimeout(() => {
        isLongPress = true;
        // Haptic feedback for long press
        this.hapticFeedback(20);
        // Open command palette
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.app as any).commands?.executeCommandById("command-palette:open");
      }, 500);
    };

    // Touch/Mouse end
    const endPress = async () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }

      // Only create note if it wasn't a long press
      if (!isLongPress) {
        this.hapticFeedback(10);
        await this.createNewNote();
      }
    };

    // Cancel on mouse/touch leave
    const cancelPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      isLongPress = false;
    };

    // Add event listeners for both touch and mouse
    fab.addEventListener("touchstart", startPress);
    fab.addEventListener("mousedown", startPress);

    fab.addEventListener("touchend", endPress);
    fab.addEventListener("mouseup", endPress);

    fab.addEventListener("touchcancel", cancelPress);
    fab.addEventListener("mouseleave", cancelPress);

    return fab;
  }

  /**
   * Triggers haptic feedback if enabled and supported
   */
  private hapticFeedback(duration: number = 10) {
    if (this.plugin.settings.enableHapticFeedback && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }

  /**
   * Creates a new note
   */
  private async createNewNote() {
    try {
      // Determine the folder path
      const folderPath = this.plugin.settings.homeFolder
        ? normalizePath(this.plugin.settings.homeFolder)
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

  /**
   * Cleans up all FABs
   */
  destroy() {
    this.fabElements.forEach((fab) => fab.remove());
    this.fabElements.clear();
  }
}
