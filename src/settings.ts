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
} from 'obsidian';

import { GestureCommand } from './gesture-handler';
import MobilePlugin from './main';

// Type for Obsidian's internal commands API (not in public API)

export interface ToolbarConfig {
  name: string;
  id: string;
  commands: string[];
}

const allowedContexts = [
  'selection',
  'list',
  'task',
  'heading',
  'code-block',
  'table',
  'blockquote',
  'link',
  'default',
] as const;

export type ContextType = (typeof allowedContexts)[number];

const contextTypeBindings = allowedContexts.map(contextType => ({
  id: `binding-${Date.now()}-${contextType}`,
  contextType: contextType,
  toolbarId: '',
}));

export interface ContextBinding {
  contextType: ContextType;
  toolbarId: string;
}

export type MobileCMDEvent =
  | 'fab-longpress'
  | 'fab-press'
  | 'fab-record-start'
  | 'fab-record-stop';

export const MobileCMDEventsDesc: Record<MobileCMDEvent, [string, string]> = {
  'fab-longpress': [
    'FAB long press',
    'Select command to execute when the "Floating Action Button" is long-pressed',
  ],
  'fab-press': [
    'FAB press',
    'Select command to execute when the "Floating Action Button" is pressed',
  ],
  'fab-record-start': [
    'FAB record start',
    'Select command to execute when the "Floating Action Button" is held down in recording mode',
  ],
  'fab-record-stop': [
    'FAB record stop',
    'Select command to execute when the "Floating Action Button" is released in recording mode',
  ],
};

export interface MobilePluginSettings {
  enableTabReordering: boolean;
  showCommandConfirmation: boolean;
  MobileCMDEvents: Record<MobileCMDEvent, string>;
  plusLongpress?: string;
  pluspress?: string;
  homeFolder: string;
  toolbars: ToolbarConfig[];
  contextBindings: ContextBinding[];
  useIcons: boolean;
  showToolbars: boolean;
  showFAB: boolean;
  commandIcons: Record<string, string>; // Map of command ID to icon name
  enableHapticFeedback: boolean;
  gestureCommands: GestureCommand[];
  showBuiltInToolbar: boolean;
  showTabsInSearchView: boolean;
}

export const DEFAULT_SETTINGS: MobilePluginSettings = {
  MobileCMDEvents: {
    'fab-longpress': 'command-palette:open',
    'fab-press': 'file-explorer:new-file',
    'fab-record-start': 'audio-recorder:start',
    'fab-record-stop': 'audio-recorder:stop',
  },
  showCommandConfirmation: true,
  homeFolder: '',
  showToolbars: true,
  showFAB: true,
  gestureCommands: [],
  toolbars: [
    {
      id: 'formatting',
      name: 'Formatting',
      commands: [
        'editor:toggle-bold',
        'editor:toggle-italics',
        'editor:toggle-strikethrough',
        'editor:toggle-highlight',
        'editor:insert-link',
        'editor:toggle-checklist-status',
        'mobile:select-more',
        'mobile:quick-audio-notes',
        'mobile:keep-in-tablet-mode',
      ],
    },
    {
      id: 'list-actions',
      name: 'List actions',
      commands: [
        'editor:toggle-checklist-status',
        'editor:indent-list',
        'editor:unindent-list',
        'editor:swap-line-up',
        'editor:swap-line-down',
        'editor:toggle-bullet-list',
        'editor:toggle-numbered-list',
      ],
    },
    {
      id: 'table-actions',
      name: 'Table actions',
      commands: [
        'editor:table-row-before',
        'editor:table-row-after',
        'editor:table-col-before',
        'editor:table-col-after',
        'editor:table-row-delete',
        'editor:table-col-delete',
        'editor:table-col-align-left',
        'editor:table-col-align-center',
        'editor:table-col-align-right',
      ],
    },
    {
      id: 'heading-actions',
      name: 'Heading actions',
      commands: [
        'editor:set-heading-0',
        'editor:set-heading-1',
        'editor:set-heading-2',
        'editor:set-heading-3',
      ],
    },
    {
      id: 'code-block-actions',
      name: 'Code block actions',
      commands: ['editor:toggle-code', 'editor:insert-codeblock'],
    },
    {
      id: 'blockquote-actions',
      name: 'Blockquote actions',
      commands: ['editor:toggle-blockquote'],
    },
    {
      id: 'link-actions',
      name: 'Link actions',
      commands: [
        'editor:follow-link',
        'editor:open-link-in-new-leaf',
        'editor:open-link-in-new-split',
      ],
    },
    {
      id: 'selection',
      name: 'Selection',
      commands: [
        'editor:copy',
        'editor:cut',
        'mobile:select-more',
        'editor:toggle-bold',
        'editor:toggle-italics',
        'editor:toggle-highlight',
        'editor:insert-link',
        'pure-chat-llm:edit-selection',
        'note-composer:split-file',
      ],
    },
  ],
  contextBindings: [
    {
      contextType: 'selection',
      toolbarId: 'selection',
    },
    {
      contextType: 'list',
      toolbarId: 'list-actions',
    },
    {
      contextType: 'task',
      toolbarId: 'list-actions',
    },
    {
      contextType: 'heading',
      toolbarId: 'heading-actions',
    },
    {
      contextType: 'code-block',
      toolbarId: 'code-block-actions',
    },
    {
      contextType: 'table',
      toolbarId: 'table-actions',
    },
    {
      contextType: 'blockquote',
      toolbarId: 'blockquote-actions',
    },
    {
      contextType: 'link',
      toolbarId: 'link-actions',
    },
    {
      contextType: 'default',
      toolbarId: 'formatting',
    },
  ],
  useIcons: true,
  commandIcons: {
    'editor:set-heading-1': 'lucide-heading-1',
    'editor:set-heading-2': 'lucide-heading-2',
    'editor:set-heading-3': 'lucide-heading-3',
    'editor:set-heading-0': 'lucide-remove-formatting',
    'editor:table-row-delete': 'lucide-table-rows-split',
    'editor:table-col-delete': 'lucide-table-columns-split',
    'editor:copy': 'lucide-copy',
    'editor:cut': 'lucide-scissors-line-dashed',
  },
  enableHapticFeedback: true,
  showBuiltInToolbar: false,
  showTabsInSearchView: false,
  enableTabReordering: true,
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
      .filter((f): f is TFolder => f instanceof TFolder);
    this.setPlaceholder(prompt || 'Search for a folder...');
  }
  getItems(): TFolder[] {
    return this.folders;
  }
  getItemText(folder: TFolder): string {
    return folder.path;
  }
  onChooseItem(folder: TFolder) {
    this.onSubmit(folder);
  }
}

/**
 * Modal for selecting an icon from available Lucide icons in Obsidian.
 *
 * Provides a searchable list of all available icon IDs with visual preview.
 * Used for customizing command icons in toolbar configurations.
 *
 * @extends SuggestModal
 */
export class IconSuggestModal extends SuggestModal<string> {
  onSubmit: (result: string) => void;
  icons: string[];
  getSuggestions(query: string): string[] | Promise<string[]> {
    const lowerQuery = query.toLowerCase();
    return this.icons.filter(icon => icon.toLowerCase().includes(lowerQuery));
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    new Setting(el)
      .setName(value)
      .addExtraButton(btn => btn.setIcon(`${value}`));
  }

  constructor(app: App, onSubmit: (result: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
    getIconIds();
    // Use a curated list of common Lucide icons available in Obsidian
    this.icons = getIconIds();

    this.setPlaceholder('Search for an icon...');
  }

  getItems(): string[] {
    return this.icons;
  }

  getItemText(item: string): string {
    return item;
  }

  onChooseItem(item: string) {
    this.onSubmit(item);
  }

  onChooseSuggestion(item: string) {
    this.onSubmit(item);
  }
}

/**
 * Modal for selecting a command from all available Obsidian commands.
 *
 * Provides fuzzy search over all registered commands in the application,
 * displaying command names and allowing quick selection. Used throughout
 * the plugin for assigning commands to various triggers (FAB, gestures, etc.).
 *
 * @extends FuzzySuggestModal
 */
export class CommandSuggestModal extends FuzzySuggestModal<Command> {
  onSubmit: (result: Command) => void;
  commands: Command[];

  constructor(
    public app: App,
    onSubmit: (result: Command) => void,
  ) {
    super(app);
    this.onSubmit = onSubmit;
    this.commands = Object.values(app.commands?.commands || {});
  }

  getItems(): Command[] {
    return this.commands;
  }

  getItemText(item: Command): string {
    return item.name;
  }

  onChooseItem(item: Command) {
    this.onSubmit(item);
  }
}

/**
 * Plugin settings tab for configuring mobile plugin options.
 *
 * Provides the main entry point for plugin settings in Obsidian's
 * settings panel. Delegates rendering to MobileSettingsView.
 *
 * @extends PluginSettingTab
 */
export class MobileSettingTab extends PluginSettingTab {
  constructor(
    public app: App,
    public plugin: MobilePlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    new MobileSettingsView(this.app, this.plugin, this.containerEl);
  }
}

/**
 * Main settings view component for the mobile plugin.
 *
 * Renders all plugin configuration options including:
 * - General settings (FAB, toolbars, haptic feedback)
 * - Context bindings (which toolbar appears in which context)
 * - Toolbar editor (manage toolbar commands and icons)
 * - FAB event commands
 * - Gesture commands
 *
 * Provides a tabbed/sectioned interface for organizing different
 * configuration areas.
 */
export class MobileSettingsView {
  constructor(
    public app: App,
    public plugin: MobilePlugin,
    public containerEl: HTMLElement,
  ) {
    this.renderGeneralSettings(containerEl);
  }

  sett<S extends keyof MobilePluginSettings>(
    key: S,
    value: MobilePluginSettings[S],
  ) {
    this.plugin.settings[key] = value;
    void this.plugin.saveSettings();
  }

  private renderContextBindings(containerEl: HTMLElement) {
    this.renderHeader(containerEl, 'bindings');
    contextTypeBindings.forEach(ctb => {
      new Setting(containerEl)
        .setName(this.getContextDisplayName(ctb.contextType))
        .then(setting => {
          this.plugin.settings.contextBindings.forEach((b, i) => {
            if (b.contextType === ctb.contextType) {
              setting.addButton(btn =>
                btn
                  .setButtonText(
                    this.plugin.settings.toolbars.find(
                      t => t.id === b.toolbarId,
                    )?.name || b.toolbarId,
                  )
                  .onClick(() => {
                    this.plugin.settings.contextBindings.splice(i, 1);
                    void this.plugin.saveSettings();
                    this.renderContextBindings(containerEl);
                  }),
              );
            }
          });
        })
        .addExtraButton(button =>
          button
            .setIcon('plus')
            .setTooltip('Add new binding')
            .onClick(() => {
              new ContextBindingChooser(
                this.app,
                this.plugin.settings.toolbars,
                toolbar => {
                  void (async () => {
                    const newBinding: ContextBinding = {
                      contextType: ctb.contextType,
                      toolbarId: toolbar.id,
                    };
                    this.plugin.settings.contextBindings.push(newBinding);
                    await this.plugin.saveSettings();
                    this.renderContextBindings(containerEl);
                  })();
                },
              ).open();
            }),
        );
    });
  }

  private renderHeader(
    containerEl: HTMLElement,
    index?: number | string,
  ): void {
    this.containerEl.empty();
    new Setting(containerEl)
      .setHeading()
      .setClass('mobile-plugin-settings-header')
      .addButton(button => {
        button.setButtonText('General settings').onClick(() => {
          this.renderGeneralSettings(containerEl);
        });
        if (index === 'general') {
          button.setCta();
        }
      })
      .addButton(button => {
        button.setButtonText('Context bindings').onClick(() => {
          this.renderContextBindings(containerEl);
        });
        if (index === 'bindings') {
          button.setCta();
        }
      })
      .then(setting =>
        this.plugin.settings.toolbars.forEach(toolbar => {
          setting.addButton(button => {
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
        }),
      )
      .addButton(button => {
        button.setButtonText('Add new toolbar').onClick(async () => {
          const newToolbar: ToolbarConfig = {
            id: `toolbar-${Date.now()}`,
            name: 'New toolbar',
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
    this.renderHeader(containerEl, 'general');
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
    new Setting(containerEl).addButton(button =>
      button
        .setButtonText('Reset to default settings')
        .setWarning()
        .onClick(async () => {
          this.plugin.settings = { ...DEFAULT_SETTINGS };
          await this.plugin.saveSettings();
          this.renderGeneralSettings(containerEl);
        }),
    );
    new Setting(containerEl)
      .setName('Show tabs in search view')
      .setDesc('Display open tabs when using the mobile search view')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.showTabsInSearchView)
          .onChange(value => this.sett('showTabsInSearchView', value)),
      );
    new Setting(containerEl)
      .setName('Enable reordering tabs by drag-and-drop')
      .setDesc('Drag and drop tabs to reorder them in the tab bar')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableTabReordering)
          .onChange(value => this.sett('enableTabReordering', value)),
      );
    new Setting(containerEl)
      .setName('Show toolbars')
      .setDesc('Show context-aware toolbars at the bottom of the screen')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.showToolbars)
          .onChange(value => this.sett('showToolbars', value)),
      );
    new Setting(containerEl)
      .setName('Show built-in toolbar')
      .setDesc(
        "Show Obsidian's built-in mobile toolbar at the bottom of the screen",
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.showBuiltInToolbar)
          .onChange(value => {
            this.sett('showBuiltInToolbar', value);
            document.body.toggleClass('hidden-mobile-toolbar', !value);
          }),
      );

    new Setting(containerEl)
      .setName('Show floating action button')
      .setDesc('Show the button at the bottom right of the screen')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.showFAB)
          .onChange(value => this.sett('showFAB', value)),
      );

    new Setting(containerEl)
      .setName('Command confirmation')
      .setDesc('Show confirmation before selecting a new command for a gesture')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.showCommandConfirmation)
          .onChange(value => this.sett('showCommandConfirmation', value)),
      );
    new Setting(containerEl)
      .setName('Use icons in toolbar')
      .setDesc(
        'Display icons instead of text labels for toolbar commands. You can customize icons for each command below.',
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.useIcons)
          .onChange(value => this.sett('useIcons', value)),
      );

    // Haptic feedback setting
    new Setting(containerEl)
      .setName('Enable haptic feedback')
      .setDesc('Vibrate on button interactions (mobile devices only)')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableHapticFeedback)
          .onChange(value => this.sett('enableHapticFeedback', value)),
      );

    Object.entries(MobileCMDEventsDesc).forEach(
      ([event, [name, desc]]: [MobileCMDEvent, [string, string]]) => {
        new Setting(containerEl)
          .setName(name)
          .setDesc(desc)
          .addButton(button =>
            button
              .setButtonText(
                this.plugin.settings.MobileCMDEvents[event] || 'Select command',
              )
              .onClick(() => {
                new CommandSuggestModal(this.app, command => {
                  void (async () => {
                    this.plugin.settings.MobileCMDEvents[event] = command.id;
                    await this.plugin.saveSettings();
                    this.renderGeneralSettings(containerEl);
                  })();
                }).open();
              }),
          )
          .addExtraButton(btn =>
            btn
              .setIcon('trash')
              .setTooltip('Clear command')
              .onClick(async () => {
                this.plugin.settings.MobileCMDEvents[event] = '';
                await this.plugin.saveSettings();
                this.renderGeneralSettings(containerEl);
              }),
          );
      },
    );
    this.plugin.settings.gestureCommands.forEach((gc, gcIndex) => {
      new Setting(containerEl)
        .setName(`Gesture command: ${gc.name}`)
        .setDesc(`ID: ${gc.commandId}`)
        .addButton(button =>
          button.setButtonText(gc.name).onClick(() => {
            new CommandSuggestModal(this.app, command => {
              void (async () => {
                gc.commandId = command.id;
                gc.name = command.name;
                await this.plugin.saveSettings();
                this.renderGeneralSettings(containerEl);
              })();
            }).open();
          }),
        )
        .addExtraButton(btn =>
          btn
            .setIcon('trash')
            .setTooltip('Delete gesture command')
            .onClick(async () => {
              this.plugin.settings.gestureCommands.splice(gcIndex, 1);
              await this.plugin.saveSettings();
              this.renderGeneralSettings(containerEl);
            }),
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
      selection: 'Selection',
      list: 'List',
      task: 'Task',
      heading: 'Heading',
      'code-block': 'Code block',
      table: 'Table',
      blockquote: 'Blockquote',
      link: 'Link',
      default: 'Default',
    };
    return names[contextType] || contextType;
  }
}

/**
 * Modal wrapper for the mobile plugin settings view.
 *
 * Allows accessing plugin settings from anywhere in the app
 * via a modal dialog, rather than only through Obsidian's
 * settings panel.
 *
 * @extends Modal
 */
export class mySettingsModel extends Modal {
  constructor(
    app: App,
    private plugin: MobilePlugin,
  ) {
    super(app);
  }

  onOpen() {
    new MobileSettingsView(this.app, this.plugin, this.contentEl);
  }
}

/**
 * Modal for selecting a context type when creating context bindings.
 *
 * Displays all available context types (selection, list, task, heading, etc.)
 * for binding to a toolbar. Used when adding new context bindings.
 *
 * @extends FuzzySuggestModal
 */
export class ContextSelectionModal extends FuzzySuggestModal<ContextBinding> {
  onSubmit: (result: ContextBinding) => void;
  bindings: ContextBinding[];

  constructor(
    app: App,
    onSubmit: (result: ContextBinding) => void,
    prompt?: string,
  ) {
    super(app);
    this.onSubmit = onSubmit;
    //
    this.bindings = contextTypeBindings;

    this.setPlaceholder(prompt || 'Create new context binding...');
  }

  getItems(): ContextBinding[] {
    return this.bindings;
  }

  getItemText(binding: ContextBinding): string {
    return `${binding.contextType} → ${binding.toolbarId}`;
  }

  onChooseItem(binding: ContextBinding) {
    this.onSubmit(binding);
  }
}

/**
 * Modal for selecting a toolbar when creating context bindings.
 *
 * Displays all available toolbars for selection when binding
 * a context type to a toolbar configuration.
 *
 * @extends FuzzySuggestModal
 */
export class ContextBindingChooser extends FuzzySuggestModal<ToolbarConfig> {
  onSubmit: (result: ToolbarConfig) => void;

  constructor(
    app: App,
    public toolbars: ToolbarConfig[],
    onSubmit: (result: ToolbarConfig) => void,
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

  onChooseItem(toolbar: ToolbarConfig) {
    this.onSubmit(toolbar);
  }
}

/**
 * Modal editor for managing toolbar configurations.
 *
 * Provides a full-featured interface for:
 * - Editing toolbar name
 * - Adding/removing commands
 * - Reordering commands via drag-and-drop
 * - Customizing command icons
 * - Managing context bindings
 * - Deleting toolbars
 *
 * Changes are saved automatically as they're made.
 *
 * @extends Modal
 */
export class ToolbarEditor extends Modal {
  deleteCallback: () => void;
  onDelete(deleteCallback: () => void) {
    this.deleteCallback = deleteCallback;
    return this;
  }
  constructor(
    public app: App,
    private plugin: MobilePlugin,
    private toolbar: ToolbarConfig,
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
      .setDesc(`${this.plugin.getBinds(this.toolbar.id).join(', ')}`)
      .then(setting =>
        this.plugin.getBinds(this.toolbar.id).forEach(bind => {
          setting.addButton(button =>
            button.setButtonText(bind).onClick(() => {
              this.plugin.settings.contextBindings =
                this.plugin.settings.contextBindings.filter(
                  b =>
                    !(
                      b.contextType === bind && b.toolbarId === this.toolbar.id
                    ),
                );
              void this.plugin.saveSettings();
              this.render(container);
            }),
          );
        }),
      )
      .addButton(btn =>
        btn
          .setButtonText('Add binding')
          .setIcon('plus')
          .onClick(() => {
            new ContextSelectionModal(
              this.app,
              binding => {
                void (async () => {
                  binding.toolbarId = this.toolbar.id;
                  this.plugin.settings.contextBindings.push(binding);
                  await this.plugin.saveSettings();
                  this.render(container);
                })();
              },
              'Create new context binding for this toolbar',
            ).open();
          }),
      )
      .addText(
        text =>
          (text
            .setPlaceholder('Toolbar name')
            .setValue(this.toolbar.name)
            .onChange(async value => {
              this.toolbar.name = value;
              await this.plugin.saveSettings();
            }).inputEl.onblur = () => this.render(container)),
      )
      .addExtraButton(btn =>
        btn
          .setIcon('trash')
          .setTooltip('Delete toolbar')
          .onClick(async () => {
            // Remove toolbar and any bindings using it
            const toolbarIndex = this.plugin.settings.toolbars.findIndex(
              t => t.id === this.toolbar.id,
            );
            this.plugin.settings.toolbars.splice(toolbarIndex, 1);
            this.plugin.settings.contextBindings =
              this.plugin.settings.contextBindings.filter(
                b => b.toolbarId !== this.toolbar.id,
              );
            await this.plugin.saveSettings();
            container.empty();
            this.deleteCallback?.();
            this.close();
          }),
      );

    this.toolbar.commands.forEach((cmdId, index) => {
      const command = this.app.commands?.findCommand?.(cmdId);

      const setting = new Setting(container)
        .setName(command?.name || cmdId)
        .setDesc(cmdId)
        .addButton(btn =>
          btn
            .setIcon(
              this.plugin.settings.commandIcons[cmdId] ||
                command?.icon ||
                'question',
            )
            .setTooltip('Change icon')
            .onClick(() => {
              new IconSuggestModal(this.app, icon => {
                void (async () => {
                  this.plugin.settings.commandIcons[cmdId] = icon;
                  await this.plugin.saveSettings();
                  this.render(container);
                })();
              }).open();
            }),
        )
        .addExtraButton(btn =>
          btn
            .setIcon('pencil')
            .setTooltip('Change command')
            .onClick(() => {
              new CommandSuggestModal(this.app, command => {
                void (async () => {
                  this.toolbar.commands[index] = command.id;
                  await this.plugin.saveSettings();
                  this.render(container);
                })();
              }).open();
            }),
        )
        .addExtraButton(btn =>
          btn
            .setIcon('trash')
            .setTooltip('Remove command')
            .onClick(async () => {
              this.toolbar.commands.splice(index, 1);
              await this.plugin.saveSettings();
              this.render(container);
            }),
        );

      const el = setting.settingEl;
      el.draggable = true;
      el.addClass('mobile-plugin-draggable-item');

      el.ondragstart = event => {
        event.dataTransfer?.setData('text/plain', index.toString());
        el.addClass('is-dragging');
      };

      el.ondragend = () => {
        el.removeClass('is-dragging');
      };

      el.ondragover = event => {
        event.preventDefault();
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        el.removeClass('drag-over-top');
        el.removeClass('drag-over-bottom');

        if (event.clientY < midY) {
          el.addClass('drag-over-top');
        } else {
          el.addClass('drag-over-bottom');
        }
      };

      el.ondragleave = () => {
        el.removeClass('drag-over-top');
        el.removeClass('drag-over-bottom');
      };

      el.ondrop = async event => {
        event.preventDefault();
        el.removeClass('drag-over-top');
        el.removeClass('drag-over-bottom');
        const oldIndex = parseInt(
          event.dataTransfer?.getData('text/plain') || '-1',
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
    new Setting(container).addButton(button =>
      button.setButtonText('Add command').onClick(() => {
        new CommandSuggestModal(this.app, command => {
          void (async () => {
            this.toolbar.commands.push(command.id);
            await this.plugin.saveSettings();
            this.render(container);
          })();
        }).open();
      }),
    );
    return this;
    // Additional settings for editing commands can be added here
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
