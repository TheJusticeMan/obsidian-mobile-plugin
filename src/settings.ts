import {
  App,
  ButtonComponent,
  Command,
  FuzzySuggestModal,
  getIconIds,
  ItemView,
  Modal,
  Notice,
  PluginSettingTab,
  Setting,
  SettingGroup,
  SuggestModal,
  TFolder,
  WorkspaceLeaf,
} from 'obsidian';
import MobilePlugin from './main';
import {
  GestureCommand,
  GestureHandler,
  Offset,
} from './utils/gesture-handler';
import { ToolbarEditor } from './views/ToolbarEditor';

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
  hideToolbarInFullscreen: boolean;
  enableCursorCommands: boolean;
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
  hideFABWhenKeyboardOpen: boolean;
  hideNativeNav: boolean;
}

export const DEFAULT_SETTINGS: MobilePluginSettings = {
  hideToolbarInFullscreen: true,
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
        'editor:paste',
        'editor:toggle-bold',
        'editor:toggle-italics',
        'editor:toggle-strikethrough',
        'editor:toggle-highlight',
        'editor:insert-link',
        'mobile:insert-multiple-images',
        'mobile:insert-multiple-attachments',
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
        'editor:cut',
        'editor:copy',
        'editor:paste',
        'mobile:select-more',
        'editor:toggle-bold',
        'editor:toggle-italics',
        'editor:toggle-highlight',
        'editor:insert-link',
        'pure-chat-llm:edit-selection',
        'note-composer:split-file',
      ],
    },
    {
      id: 'caret',
      name: 'Caret',
      commands: [
        'editor:move-caret-up',
        'editor:move-caret-down',
        'editor:move-caret-left',
        'editor:move-caret-right',
        'mobile:select-all',
        'mobile:select-word',
        'mobile:expand-selection',
        'mobile:shrink-selection',
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
    {
      contextType: 'default',
      toolbarId: 'caret',
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
  enableCursorCommands: false,
  hideFABWhenKeyboardOpen: false,
  hideNativeNav: false,
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
  icon: string = 'smartphone';

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
    this.renderGeneralSettings();
  }

  sett<S extends keyof MobilePluginSettings>(
    key: S,
    value: MobilePluginSettings[S],
  ) {
    this.plugin.settings[key] = value;
    void this.plugin.saveSettings();
  }

  private renderContextBindings() {
    const containerEl = this.containerEl;
    const group = new SettingGroup(containerEl).setHeading('Context Bindings');

    contextTypeBindings.forEach(ctb => {
      group.addSetting(
        setting =>
          void setting
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
                        this.renderGeneralSettings();
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
                        this.renderGeneralSettings();
                      })();
                    },
                  ).open();
                }),
            ),
      );
    });
  }

  private renderGeneralSettings() {
    this.containerEl.empty();
    new SettingGroup(this.containerEl)
      .addSetting(
        setting =>
          void setting
            .setName('Show toolbars')
            .setDesc('Show context-aware toolbars at the bottom of the screen')
            .addToggle(toggle =>
              toggle
                .setValue(this.plugin.settings.showToolbars)
                .onChange(value => this.sett('showToolbars', value)),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Show built-in toolbar')
            .setDesc(
              "Display Obsidian's native mobile toolbar at the bottom of the screen",
            )
            .addToggle(toggle =>
              toggle
                .setValue(this.plugin.settings.showBuiltInToolbar)
                .onChange(value => {
                  this.sett('showBuiltInToolbar', value);
                  document.body.toggleClass('hidden-mobile-toolbar', !value);
                }),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Show floating action button')
            .setDesc(
              'Show the floating action button in the bottom-right corner',
            )
            .addToggle(toggle =>
              toggle
                .setValue(this.plugin.settings.showFAB)
                .onChange(value => this.sett('showFAB', value)),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Hide floating action button when keyboard is open')
            .setDesc(
              'Automatically hide the floating action button when the on-screen keyboard is visible',
            )
            .addToggle(toggle =>
              toggle
                .setValue(this.plugin.settings.hideFABWhenKeyboardOpen)
                .onChange(value => {
                  this.sett('hideFABWhenKeyboardOpen', value);
                  document.body.toggleClass('hideFABWhenKeyboardOpen', value);
                }),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Show tabs in search view')
            .setDesc('Display open tabs when using the mobile search view')
            .addToggle(toggle =>
              toggle
                .setValue(this.plugin.settings.showTabsInSearchView)
                .onChange(value => this.sett('showTabsInSearchView', value)),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Enable reordering tabs by drag-and-drop')
            .setDesc('Allow dragging tabs to reorder them in the tab view')
            .addToggle(toggle =>
              toggle
                .setValue(this.plugin.settings.enableTabReordering)
                .onChange(value => this.sett('enableTabReordering', value)),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Hide toolbar in fullscreen mode')
            .setDesc(
              'Automatically hide the mobile toolbar when entering fullscreen mode',
            )
            .addToggle(toggle =>
              toggle
                .setValue(this.plugin.settings.hideToolbarInFullscreen)
                .onChange(value => {
                  this.sett('hideToolbarInFullscreen', value);
                  document.body.toggleClass(
                    'hide-toolbar-for-fullscreen',
                    value,
                  );
                }),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Use icons in toolbar')
            .setDesc(
              'Show icons instead of text labels for toolbar commands; icons can be customized per command below',
            )
            .addToggle(toggle =>
              toggle
                .setValue(this.plugin.settings.useIcons)
                .onChange(value => this.sett('useIcons', value)),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Enable haptic feedback')
            .setDesc('Vibrate on button interactions (mobile devices only)')
            .addToggle(toggle =>
              toggle
                .setValue(this.plugin.settings.enableHapticFeedback)
                .onChange(value => this.sett('enableHapticFeedback', value)),
            ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Command confirmation')
            .setDesc(
              'Ask for confirmation before opening the command picker when assigning a command to a gesture',
            )
            .addToggle(toggle =>
              toggle
                .setValue(this.plugin.settings.showCommandConfirmation)
                .onChange(value => this.sett('showCommandConfirmation', value)),
            ),
      );
    const fabEventCommandSettings = new SettingGroup(
      this.containerEl,
    ).setHeading('FAB event commands');
    Object.entries(MobileCMDEventsDesc).forEach(
      ([event, [name, desc]]: [MobileCMDEvent, [string, string]]) => {
        fabEventCommandSettings.addSetting(
          setting =>
            void setting
              .setName(name)
              .setDesc(desc)
              .addButton(button =>
                button
                  .setButtonText(
                    this.plugin.settings.MobileCMDEvents[event] ||
                      'Select command',
                  )
                  .onClick(() => {
                    new CommandSuggestModal(this.app, command => {
                      void (async () => {
                        this.plugin.settings.MobileCMDEvents[event] =
                          command.id;
                        await this.plugin.saveSettings();
                        this.renderGeneralSettings();
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
                    this.renderGeneralSettings();
                  }),
              ),
        );
      },
    );

    const gestureCommandSettings = new SettingGroup(
      this.containerEl,
    ).setHeading('Gesture Commands');
    if (this.plugin.settings.gestureCommands.length === 0) {
      gestureCommandSettings.addSetting(
        setting =>
          void setting
            .setName('No gesture commands configured yet.')
            .setDesc(
              'Click and drag the floating action button to create gesture commands.',
            ),
      );
    }
    this.plugin.settings.gestureCommands.forEach((gc, gcIndex) =>
      gestureCommandSettings.addSetting(setting => {
        setting
          .setName(gc.name)
          .setDesc(gc.commandId)
          .addExtraButton(btn =>
            btn
              .setIcon(
                /* Register and add SVG icon as the edit button*/
                GestureHandler.getGestureIcon(gc),
              )
              .setTooltip('Edit gesture drawing')
              .onClick(() => {
                new EditGestureDrawingModal(this.app, this.plugin, gc, () =>
                  this.renderGeneralSettings(),
                ).open();
              }),
          )
          .addExtraButton(button =>
            button.setIcon('pencil').onClick(() => {
              new CommandSuggestModal(this.app, command => {
                void (async () => {
                  gc.commandId = command.id;
                  gc.name = command.name;
                  await this.plugin.saveSettings();
                  this.renderGeneralSettings();
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
                this.renderGeneralSettings();
              }),
          );
      }),
    );
    gestureCommandSettings.addSetting(
      setting =>
        void setting.setName('Add new gesture command').addButton(btn =>
          btn.setButtonText('Add').onClick(() => {
            new CommandSuggestModal(this.app, command => {
              const newCommand: GestureCommand = {
                name: command.name,
                commandId: command.id,
                gesturePath: '',
              };
              this.plugin.settings.gestureCommands.push(newCommand);
              new EditGestureDrawingModal(
                this.app,
                this.plugin,
                newCommand,
                () => this.renderGeneralSettings(),
              ).open();
            }).open();
          }),
        ),
    );

    this.renderToolbars();
    this.renderContextBindings();
    new SettingGroup(this.containerEl)
      .setHeading('Danger Zone')
      .addSetting(
        setting =>
          void setting
            .setName('Hide native navigation')
            .setDesc(
              "Hide Obsidian's built-in navigation bar on mobile devices",
            )
            .addToggle(toggle =>
              toggle
                .setValue(this.plugin.settings.hideNativeNav)
                .onChange(value => {
                  this.sett('hideNativeNav', value);
                  this.plugin.toggleHideNav(value);
                }),
            ),
      )
      .addSetting(
        setting =>
          void setting.addButton(button =>
            button
              .setButtonText('Reset to default settings')
              .setWarning()
              .onClick(async () => {
                this.plugin.settings = { ...DEFAULT_SETTINGS };
                await this.plugin.saveSettings();
                this.renderGeneralSettings();
              }),
          ),
      );
  }

  renderToolbars() {
    new ToolbarEditor(
      this.app,
      this.plugin,
      this.plugin.settings.toolbars[0],
    ).render(this.containerEl.createDiv('mobile-plugin-toolbar-editor'));
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
export class settingsModel extends Modal {
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

export const VIEW_TYPE_SETTINGS = 'mobile-plugin-settings';

export class settingsLeaf extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private plugin: MobilePlugin,
  ) {
    super(leaf);
  }
  getViewType(): string {
    return VIEW_TYPE_SETTINGS;
  }
  getDisplayText(): string {
    return 'Mobile plugin settings';
  }
  protected onOpen(): Promise<void> {
    new MobileSettingsView(this.app, this.plugin, this.contentEl);
    return Promise.resolve();
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
 * Modal for editing the drawing of an existing gesture.
 *
 * Provides a large drawing area where the user can redraw the gesture path.
 * The new path is automatically normalized and saved to the gesture command.
 */
export class EditGestureDrawingModal extends Modal {
  private gestureHandler: GestureHandler;

  constructor(
    app: App,
    private plugin: MobilePlugin,
    private gesture: GestureCommand,
    private onSave: () => void,
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    /* contentEl.addClass('edit-gesture-modal'); */
    this.setTitle(`Edit drawing for: ${this.gesture.name}`);
    new Setting(contentEl).setDesc(
      'Draw the new gesture in the area below. It will be saved automatically when you release.',
    );

    contentEl.setCssStyles({ paddingBottom: '70vh' });

    this.gestureHandler = new GestureHandler(
      this.app,
      new ButtonComponent(contentEl).setIcon('plus').setClass('mobile-fab')
        .buttonEl,
      this.plugin.settings.gestureCommands.filter(gc => gc !== this.gesture),
      (line: Offset[], gestureCommand: GestureCommand | null) => {
        // Found a matching gesture, do not save
        if (gestureCommand)
          return new Notice(
            `Gesture matches existing command: ${gestureCommand.name}`,
          );

        this.gesture.gesturePath = JSON.stringify(
          line.map((p: Offset) => [
            Number(p.x.toFixed(2)),
            Number(p.y.toFixed(2)),
          ]),
        );
        void this.plugin.saveSettings();
        this.onSave();
        this.close();
      },
      true,
    );
  }

  onClose() {
    this.gestureHandler?.destroy();
    this.contentEl.empty();
  }
}
