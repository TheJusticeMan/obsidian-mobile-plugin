import {
  App,
  Command,
  FuzzySuggestModal,
  getIconIds,
  Modal,
  PluginSettingTab,
  Setting,
  SuggestModal,
  TFolder,
} from "obsidian";
import { GestureCommand } from "./fab";
import MobilePlugin from "./main";

export interface ToolbarConfig {
  name: string;
  id: string;
  commands: string[];
}

export type ContextType =
  | "selection"
  | "list"
  | "task"
  | "heading"
  | "code-block"
  | "table"
  | "blockquote"
  | "link"
  | "default";

const contextTypeBindings = [
  "selection",
  "list",
  "task",
  "heading",
  "code-block",
  "table",
  "blockquote",
  "link",
  "default",
].map((contextType) => ({
  id: `binding-${Date.now()}-${contextType}`,
  contextType: contextType as ContextType,
  toolbarId: "",
}));

export interface ContextBinding {
  contextType: ContextType;
  toolbarId: string;
}

export interface MobilePluginSettings {
  showCommandConfirmation: boolean;
  plusLongpress: string;
  pluspress: string;
  homeFolder: string;
  toolbarCommands: string[]; // Deprecated - kept for backward compatibility
  toolbars: ToolbarConfig[];
  contextBindings: ContextBinding[];
  useIcons: boolean;
  commandIcons: Record<string, string>; // Map of command ID to icon name
  enableHapticFeedback: boolean;
  gestureCommands: GestureCommand[];
}

export const DEFAULT_SETTINGS: MobilePluginSettings = {
  plusLongpress: "command-palette:open",
  pluspress: "file-explorer:new-file",
  showCommandConfirmation: true,
  homeFolder: "",
  toolbarCommands: [
    "editor:toggle-bold",
    "editor:toggle-italics",
    "editor:insert-link",
  ],
  gestureCommands: [],
  toolbars: [
    {
      id: "formatting",
      name: "Formatting",
      commands: [
        "editor:toggle-bold",
        "editor:toggle-italics",
        "editor:insert-link",
      ],
    },
    {
      id: "list-actions",
      name: "List actions",
      commands: [
        "editor:toggle-checklist-status",
        "editor:indent-list",
        "editor:unindent-list",
      ],
    },
  ],
  contextBindings: [
    {
      contextType: "selection",
      toolbarId: "formatting",
    },
    {
      contextType: "list",
      toolbarId: "list-actions",
    },
    {
      contextType: "default",
      toolbarId: "formatting",
    },
  ],
  useIcons: true,
  commandIcons: {},
  enableHapticFeedback: true,
};

/**
 * A modal dialog that provides fuzzy search and selection of folders within the vault.
 *
 * Extends `FuzzySuggestModal<TFolder>` to allow users to quickly find and select a folder.
 *
 * @remarks
 * - The list of folders is populated from all loaded files in the vault, filtered to only include instances of `TFolder`.
 * - The modal displays the folder's path as the search text.
 * - When a folder is chosen, the provided `onSubmit` callback is invoked with the selected folder.
 * - An optional prompt can be set as the placeholder text in the search input.
 *
 * @example
 * ```typescript
 * new FolderSuggest(app, (folder) => {
 *   // Handle selected folder
 * });
 * ```
 *
 * @param app - The Obsidian application instance.
 * @param onSubmit - Callback invoked when a folder is selected.
 * @param prompt - Optional placeholder text for the search input.
 */
export class FolderSuggest extends FuzzySuggestModal<TFolder> {
  onSubmit: (result: TFolder) => void;
  folders: TFolder[];
  constructor(app: App, onSubmit: (result: TFolder) => void, prompt?: string) {
    super(app);
    this.onSubmit = onSubmit;
    this.folders = app.vault
      .getAllLoadedFiles()
      .filter((f) => f instanceof TFolder) as TFolder[];
    this.setPlaceholder(prompt || "Search for a folder...");
  }
  getItems(): TFolder[] {
    return this.folders;
  }
  getItemText(folder: TFolder): string {
    return folder.path;
  }
  onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent) {
    this.onSubmit(folder);
  }
}

export class IconSuggestModal extends SuggestModal<string> {
  onSubmit: (result: string) => void;
  icons: string[];
  getSuggestions(query: string): string[] | Promise<string[]> {
    const lowerQuery = query.toLowerCase();
    return this.icons.filter((icon) => icon.toLowerCase().includes(lowerQuery));
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    new Setting(el)
      .setName(value)
      .addExtraButton((btn) => btn.setIcon(`${value}`));
  }

  constructor(app: App, onSubmit: (result: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
    getIconIds();
    // Use a curated list of common Lucide icons available in Obsidian
    this.icons = getIconIds();

    this.setPlaceholder("Search for an icon...");
  }

  getItems(): string[] {
    return this.icons;
  }

  getItemText(item: string): string {
    return item;
  }

  onChooseItem(item: string, evt: MouseEvent | KeyboardEvent) {
    this.onSubmit(item);
  }

  onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
    this.onSubmit(item);
  }
}

export class CommandSuggestModal extends FuzzySuggestModal<Command> {
  onSubmit: (result: Command) => void;
  commands: Command[];

  constructor(app: App, onSubmit: (result: Command) => void) {
    super(app);
    this.onSubmit = onSubmit;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Obsidian's commands API is not typed
    this.commands = Object.values((this.app as any).commands.commands);
  }

  getItems(): Command[] {
    return this.commands;
  }

  getItemText(item: Command): string {
    return item.name;
  }

  onChooseItem(item: Command, evt: MouseEvent | KeyboardEvent) {
    this.onSubmit(item);
  }
}

export class MobileSettingTab extends PluginSettingTab {
  constructor(public app: App, public plugin: MobilePlugin) {
    super(app, plugin);
  }

  display(): void {
    new MobileSettingsView(this.app, this.plugin, this.containerEl);
  }
}

export class MobileSettingsView {
  constructor(
    public app: App,
    public plugin: MobilePlugin,
    public containerEl: HTMLElement
  ) {
    this.renderGeneralSettings(containerEl);
  }

  private renderContextBindings(containerEl: HTMLElement) {
    this.renderHeader(containerEl, "bindings");
    contextTypeBindings.forEach((ctb) => {
      new Setting(containerEl)
        .setName(this.getContextDisplayName(ctb.contextType))
        .then((setting) => {
          this.plugin.settings.contextBindings.forEach((b, i) => {
            if (b.contextType === ctb.contextType) {
              setting.addButton((btn) =>
                btn
                  .setButtonText(
                    this.plugin.settings.toolbars.find(
                      (t) => t.id === b.toolbarId
                    )?.name || b.toolbarId
                  )
                  .onClick(() => {
                    this.plugin.settings.contextBindings.splice(i, 1);
                    void this.plugin.saveSettings();
                    this.renderContextBindings(containerEl);
                  })
              );
            }
          });
        })
        .addExtraButton((button) =>
          button
            .setIcon("plus")
            .setTooltip("Add new binding")
            .onClick(async () => {
              new ContextBindingChooser(
                this.app,
                this.plugin.settings.toolbars,
                async (toolbar) => {
                  const newBinding: ContextBinding = {
                    contextType: ctb.contextType,
                    toolbarId: toolbar.id,
                  };
                  this.plugin.settings.contextBindings.push(newBinding);
                  await this.plugin.saveSettings();
                  this.renderContextBindings(containerEl);
                }
              ).open();
            })
        );
    });
  }

  private renderHeader(containerEl: HTMLElement, index?: number | string): void {
    this.containerEl.empty();
    new Setting(containerEl)
      .setHeading()
      .setClass("mobile-plugin-settings-header")
      .addButton((button) => {
        button.setButtonText("General settings").onClick(() => {
          this.renderGeneralSettings(containerEl);
        });
        if (index === "general") {
          button.setCta();
        }
      })
      .addButton((button) => {
        button.setButtonText("Context bindings").onClick(() => {
          this.renderContextBindings(containerEl);
        });
        if (index === "bindings") {
          button.setCta();
        }
      })
      .then((setting) =>
        this.plugin.settings.toolbars.forEach((toolbar) => {
          setting.addButton((button) => {
            button
              .setButtonText(`Edit toolbar: ${toolbar.name}`)
              .onClick(() => {
                this.renderHeader(containerEl, toolbar.id);
                this.renderToolbar(containerEl, toolbar);
              });
            if (index === toolbar.id) {
              button.setCta();
            }
          });
        })
      )
      .addButton((button) => {
        button.setButtonText("Add new toolbar").onClick(async () => {
          const newToolbar: ToolbarConfig = {
            id: `toolbar-${Date.now()}`,
            name: "New toolbar",
            commands: [],
          };
          this.plugin.settings.toolbars.push(newToolbar);
          await this.plugin.saveSettings();
          this.renderHeader(containerEl, newToolbar.id);
          this.renderToolbar(containerEl, newToolbar);
        });
      });
  }

  private renderGeneralSettings(containerEl: HTMLElement) {
    this.renderHeader(containerEl, "general");
    /*     // Home folder setting
    new Setting(containerEl)
      .setName("Home folder")
      .setDesc(
        "Folder where new notes will be created. Leave empty for vault root."
      )
      .addButton((button) =>
        button
          .setButtonText(this.plugin.settings.homeFolder || "Select folder")
          .onClick(() => {
            new FolderSuggest(
              this.app,
              (folder) => {
                this.plugin.settings.homeFolder = folder.path;
                this.plugin.saveSettings();
                button.setButtonText(folder.path);
              },
              "Select a home folder"
            ).open();
          })
      )
      .addExtraButton((button) =>
        button
          .setIcon("cross")
          .setTooltip("Clear folder")
          .onClick(async () => {
            this.plugin.settings.homeFolder = "";
            await this.plugin.saveSettings();
            this.display();
          })
      ); */
    new Setting(containerEl).addButton((button) =>
      button
        .setButtonText("Reset to default settings")
        .setWarning()
        .onClick(async () => {
          this.plugin.settings = { ...DEFAULT_SETTINGS };
          await this.plugin.saveSettings();
          this.renderGeneralSettings(containerEl);
        })
    );
    new Setting(containerEl)
      .setName("Command confirmation")
      .setDesc("Show confirmation before selecting a new command for a gesture")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showCommandConfirmation)
          .onChange(async (value) => {
            this.plugin.settings.showCommandConfirmation = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("Use icons in toolbar")
      .setDesc(
        "Display icons instead of text labels for toolbar commands. You can customize icons for each command below."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useIcons)
          .onChange(async (value) => {
            this.plugin.settings.useIcons = value;
            await this.plugin.saveSettings();
          })
      );

    // Haptic feedback setting
    new Setting(containerEl)
      .setName("Enable haptic feedback")
      .setDesc(
        "Vibrate on FAB and toolbar button interactions (mobile devices only)"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableHapticFeedback)
          .onChange(async (value) => {
            this.plugin.settings.enableHapticFeedback = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("Plus long press command")
      .setDesc("Commands available for long press on the FAB button.")
      .addButton((button) =>
        button.setButtonText(this.plugin.settings.plusLongpress).onClick(() => {
          new CommandSuggestModal(this.app, async (command) => {
            this.plugin.settings.plusLongpress = command.id;
            await this.plugin.saveSettings();
            this.renderGeneralSettings(containerEl);
          }).open();
        })
      );
    new Setting(containerEl)
      .setName("Plus press command")
      .setDesc("Commands available for press on the FAB button.")
      .addButton((button) =>
        button.setButtonText(this.plugin.settings.pluspress).onClick(() => {
          new CommandSuggestModal(this.app, async (command) => {
            this.plugin.settings.pluspress = command.id;
            await this.plugin.saveSettings();
            this.renderGeneralSettings(containerEl);
          }).open();
        })
      );

    this.plugin.settings.gestureCommands.forEach((gc, gcIndex) => {
      new Setting(containerEl)
        .setName(`Gesture command: ${gc.name}`)
        .setDesc(`ID: ${gc.commandId}`)
        .addButton((button) =>
          button.setButtonText(gc.name).onClick(() => {
            new CommandSuggestModal(this.app, async (command) => {
              gc.commandId = command.id;
              gc.name = command.name;
              await this.plugin.saveSettings();
              this.renderGeneralSettings(containerEl);
            }).open();
          })
        )
        .addExtraButton((btn) =>
          btn
            .setIcon("trash")
            .setTooltip("Delete gesture command")
            .onClick(async () => {
              this.plugin.settings.gestureCommands.splice(gcIndex, 1);
              await this.plugin.saveSettings();
              this.renderGeneralSettings(containerEl);
            })
        );
    });
  }

  renderToolbar(container: HTMLElement, toolbar: ToolbarConfig) {
    // Command list for this toolbar
    const commandListContainer = container.createDiv();
    new ToolbarEditor(this.app, this.plugin, toolbar)
      .render(commandListContainer)
      .onDelete(() => {
        this.renderGeneralSettings(container);
      });
  }

  getContextDisplayName(contextType: ContextType): string {
    const names: Record<ContextType, string> = {
      selection: "Selection",
      list: "List",
      task: "Task",
      heading: "Heading",
      "code-block": "Code block",
      table: "Table",
      blockquote: "Blockquote",
      link: "Link",
      default: "Default",
    };
    return names[contextType] || contextType;
  }
}

export class mySettingsModel extends Modal {
  constructor(app: App, private plugin: MobilePlugin) {
    super(app);
  }

  onOpen() {
    new MobileSettingsView(this.app, this.plugin, this.contentEl);
  }
}

export class ContextSelectionModal extends FuzzySuggestModal<ContextBinding> {
  onSubmit: (result: ContextBinding) => void;
  bindings: ContextBinding[];

  constructor(
    app: App,
    onSubmit: (result: ContextBinding) => void,
    prompt?: string
  ) {
    super(app);
    this.onSubmit = onSubmit;
    //
    this.bindings = contextTypeBindings;

    this.setPlaceholder(prompt || "Create new context binding...");
  }

  getItems(): ContextBinding[] {
    return this.bindings;
  }

  getItemText(binding: ContextBinding): string {
    return `${binding.contextType} → ${binding.toolbarId}`;
  }

  onChooseItem(binding: ContextBinding, evt: MouseEvent | KeyboardEvent) {
    this.onSubmit(binding);
  }
}

export class ContextBindingChooser extends FuzzySuggestModal<ToolbarConfig> {
  onSubmit: (result: ToolbarConfig) => void;

  constructor(
    app: App,
    public toolbars: ToolbarConfig[],
    onSubmit: (result: ToolbarConfig) => void
  ) {
    super(app);
    this.onSubmit = onSubmit;
  }

  getItems(): ToolbarConfig[] {
    return this.toolbars;
  }

  getItemText(toolbar: ToolbarConfig): string {
    return toolbar.name;
  }

  onChooseItem(toolbar: ToolbarConfig, evt: MouseEvent | KeyboardEvent) {
    this.onSubmit(toolbar);
  }
}

export class ToolbarEditor extends Modal {
  deleteCallback: () => void;
  onDelete(deleteCallback: () => void) {
    this.deleteCallback = deleteCallback;
    return this;
  }
  constructor(
    public app: App,
    private plugin: MobilePlugin,
    private toolbar: ToolbarConfig
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    // Further implementation for editing the toolbar can be added here
    this.render(contentEl);
  }

  render(container: HTMLElement) {
    container.empty();
    // Implementation for rendering toolbar editing UI goes here
    new Setting(container)
      .setName(this.toolbar.name)
      .setDesc(`${this.plugin.getBinds(this.toolbar.id).join(", ")}`)
      .then((setting) =>
        this.plugin.getBinds(this.toolbar.id).forEach((bind) => {
          setting.addButton((button) =>
            button.setButtonText(bind).onClick(() => {
              this.plugin.settings.contextBindings =
                this.plugin.settings.contextBindings.filter(
                  (b) =>
                    !(b.contextType === bind && b.toolbarId === this.toolbar.id)
                );
              void this.plugin.saveSettings();
              this.render(container);
            })
          );
        })
      )
      .addButton((btn) =>
        btn
          .setButtonText("Add binding")
          .setIcon("plus")
          .onClick(async () => {
            new ContextSelectionModal(
              this.app,
              async (binding) => {
                binding.toolbarId = this.toolbar.id;
                this.plugin.settings.contextBindings.push(binding);
                await this.plugin.saveSettings();
                this.render(container);
              },
              "Create new context binding for this toolbar"
            ).open();
          })
      )
      .addText(
        (text) =>
          (text
            .setPlaceholder("Toolbar name")
            .setValue(this.toolbar.name)
            .onChange(async (value) => {
              this.toolbar.name = value;
              await this.plugin.saveSettings();
            }).inputEl.onblur = () => this.render(container))
      )
      .addExtraButton((btn) =>
        btn
          .setIcon("trash")
          .setTooltip("Delete toolbar")
          .onClick(async () => {
            // Remove toolbar and any bindings using it
            const toolbarIndex = this.plugin.settings.toolbars.findIndex(
              (t) => t.id === this.toolbar.id
            );
            this.plugin.settings.toolbars.splice(toolbarIndex, 1);
            this.plugin.settings.contextBindings =
              this.plugin.settings.contextBindings.filter(
                (b) => b.toolbarId !== this.toolbar.id
              );
            await this.plugin.saveSettings();
            container.empty();
            this.deleteCallback?.();
            this.close();
          })
      );

    const commands = this.toolbar.commands;

    commands.forEach((cmdId, index) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Obsidian's commands API is not typed
      const command = (this.app as any).commands.findCommand(cmdId);
      const commandName = command ? command.name : cmdId;
      const defaultIcon = command?.icon || "";
      const customIcon =
        this.plugin.settings.commandIcons[cmdId] || defaultIcon;

      const setting = new Setting(container)
        .setName(commandName)
        .setDesc(cmdId)
        .addButton((btn) =>
          btn
            .setIcon(customIcon || "question")
            .setTooltip("Change icon")
            .onClick(() => {
              new IconSuggestModal(this.app, async (icon) => {
                this.plugin.settings.commandIcons[cmdId] = icon;
                await this.plugin.saveSettings();
                this.render(container);
              }).open();
            })
        )
        .addExtraButton((btn) =>
          btn
            .setIcon("pencil")
            .setTooltip("Change command")
            .onClick(async () => {
              new CommandSuggestModal(this.app, async (command) => {
                this.toolbar.commands[index] = command.id;
                await this.plugin.saveSettings();
                this.render(container);
              }).open();
            })
        )
        .addExtraButton((btn) =>
          btn
            .setIcon("trash")
            .setTooltip("Remove command")
            .onClick(async () => {
              this.toolbar.commands.splice(index, 1);
              await this.plugin.saveSettings();
              this.render(container);
            })
        );

      const el = setting.settingEl;
      el.draggable = true;
      el.addClass("mobile-plugin-draggable-item");

      el.ondragstart = (event) => {
        event.dataTransfer?.setData("text/plain", index.toString());
        el.addClass("is-dragging");
      };

      el.ondragend = () => {
        el.removeClass("is-dragging");
      };

      el.ondragover = (event) => {
        event.preventDefault();
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        el.removeClass("drag-over-top");
        el.removeClass("drag-over-bottom");

        if (event.clientY < midY) {
          el.addClass("drag-over-top");
        } else {
          el.addClass("drag-over-bottom");
        }
      };

      el.ondragleave = () => {
        el.removeClass("drag-over-top");
        el.removeClass("drag-over-bottom");
      };

      el.ondrop = async (event) => {
        event.preventDefault();
        el.removeClass("drag-over-top");
        el.removeClass("drag-over-bottom");
        const oldIndex = parseInt(
          event.dataTransfer?.getData("text/plain") || "-1"
        );

        if (oldIndex >= 0) {
          const rect = el.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const insertAfter = event.clientY >= midY;

          let targetIndex = index;
          if (insertAfter) targetIndex++;

          const item = this.toolbar.commands.splice(oldIndex, 1)[0];

          if (oldIndex < targetIndex) {
            targetIndex--;
          }

          this.toolbar.commands.splice(targetIndex, 0, item);
          await this.plugin.saveSettings();
          this.render(container);
        }
      };
    });
    new Setting(container).addButton((button) =>
      button
        .setButtonText("Add command")
        .setClass("mobile-add-command-btn")
        .onClick(() => {
          new CommandSuggestModal(this.app, async (command) => {
            this.toolbar.commands.push(command.id);
            await this.plugin.saveSettings();
            this.render(container);
          }).open();
        })
    );
    return this;
    // Additional settings for editing commands can be added here
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
