import { Modal, App, SettingGroup } from 'obsidian';
import { SortableList } from '../components/SortableList';
import MobilePlugin from '../main';
import {
  ToolbarConfig,
  ContextSelectionModal,
  IconSuggestModal,
  CommandSuggestModal,
} from '../settings';

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
  deleteCallback: () => void = () => {};
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
    // Further implementation for editing the toolbar can be added here
    this.render();
  }

  render(contentEl: HTMLElement = this.contentEl) {
    this.contentEl = contentEl;
    contentEl.empty();

    this.renderToolbar(contentEl, this.toolbar);
    return this;
  }

  private renderToolbar(container: HTMLElement, toolbar: ToolbarConfig) {
    // Implementation for rendering toolbar editing UI goes here
    new SettingGroup(container)
      .setHeading('Toolbar Editor')
      .addSetting(
        setting =>
          void setting
            .setName(toolbar.name)
            .setDesc(
              `Bound to contexts: ${this.plugin.getBinds(toolbar.id).join(', ') || 'None'}`,
            )
            .addExtraButton(button =>
              button
                .setIcon('pencil')
                .setTooltip('Edit toolbar name and bindings')
                .onClick(() => {
                  this.renderEditorForToolbar(container, toolbar);
                }),
            )
            .addExtraButton(btn =>
              btn
                .setIcon('trash')
                .setTooltip('Delete toolbar')
                .onClick(async () => {
                  // Remove toolbar and any bindings using it
                  const toolbarIndex = this.plugin.settings.toolbars.findIndex(
                    t => t.id === toolbar.id,
                  );
                  this.plugin.settings.toolbars.splice(toolbarIndex, 1);
                  this.plugin.settings.contextBindings =
                    this.plugin.settings.contextBindings.filter(
                      b => b.toolbarId !== toolbar.id,
                    );
                  await this.plugin.saveSettings();
                  container.empty();
                  this.deleteCallback?.();
                  this.close();
                }),
            )
            .addDropdown(dropdown =>
              dropdown
                .addOptions(
                  Object.fromEntries(
                    this.plugin.settings.toolbars.map(t => [t.id, t.name]),
                  ),
                )
                .addOption('new', 'Create new toolbar')
                .setValue(toolbar.id)
                .onChange(value => {
                  if (value === 'new') {
                    const newToolbar: ToolbarConfig = {
                      id: `toolbar-${Date.now()}`,
                      name: 'New toolbar',
                      commands: [],
                    };
                    this.plugin.settings.toolbars.push(newToolbar);
                    this.toolbar = newToolbar;
                  } else {
                    const newToolbar = this.plugin.settings.toolbars.find(
                      t => t.id === value,
                    );
                    if (newToolbar) this.toolbar = newToolbar;
                  }
                  this.render();
                }),
            ),
      )
      .addSetting(
        setting =>
          void setting.setName('Commands').addButton(button =>
            button.setButtonText('Add').onClick(() => {
              new CommandSuggestModal(this.app, command => {
                void (async () => {
                  toolbar.commands.push(command.id);
                  await this.plugin.saveSettings();
                  this.render();
                })();
              }).open();
            }),
          ),
      )
      .addSetting(setting => {
        const el = setting.settingEl;
        el.empty();
        el.className = 'setting-group';
        new SortableList(el, toolbar.commands).useSetting(
          (setting, cmdId, index) => {
            const command = this.app.commands?.findCommand?.(cmdId);
            setting
              .setName(command?.name || cmdId)
              .setDesc(cmdId)
              .addExtraButton(btn =>
                btn
                  .setIcon(
                    this.plugin.settings.commandIcons[cmdId] ||
                      command?.icon ||
                      'circle-question-mark',
                  )
                  .setTooltip('Change icon')
                  .onClick(() => {
                    new IconSuggestModal(this.app, icon => {
                      void (async () => {
                        this.plugin.settings.commandIcons[cmdId] = icon;
                        await this.plugin.saveSettings();
                        this.render();
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
                        toolbar.commands[index] = command.id;
                        await this.plugin.saveSettings();
                        this.render();
                      })();
                    }).open();
                  }),
              )
              .addExtraButton(btn =>
                btn
                  .setIcon('trash')
                  .setTooltip('Remove command')
                  .onClick(async () => {
                    toolbar.commands.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.render();
                  }),
              );
          },
        );
      });
    return this;
    // Additional settings for editing commands can be added here
  }
  renderEditorForToolbar(container: HTMLElement, toolbar: ToolbarConfig) {
    container.empty();

    new SettingGroup(container)
      .setHeading('Edit Toolbar')
      .addSetting(
        setting =>
          void setting.setName('Toolbar name').addText(text =>
            text
              .setPlaceholder('Toolbar name')
              .setValue(toolbar.name)
              .onChange(async value => {
                toolbar.name = value;
                await this.plugin.saveSettings();
              }),
          ),
      )
      .addSetting(
        setting =>
          void setting
            .setName('Bindings')
            .then(setting =>
              this.plugin.getBinds(toolbar.id).forEach(bind => {
                setting.addButton(button =>
                  button.setButtonText(bind).onClick(() => {
                    this.plugin.settings.contextBindings =
                      this.plugin.settings.contextBindings.filter(
                        b =>
                          !(
                            b.contextType === bind && b.toolbarId === toolbar.id
                          ),
                      );
                    void this.plugin.saveSettings();
                    this.render();
                  }),
                );
              }),
            )
            .addExtraButton(btn =>
              btn.setIcon('plus').onClick(() => {
                new ContextSelectionModal(
                  this.app,
                  binding => {
                    void (async () => {
                      binding.toolbarId = toolbar.id;
                      this.plugin.settings.contextBindings.push(binding);
                      await this.plugin.saveSettings();
                      this.render();
                    })();
                  },
                  'Create new context binding for this toolbar',
                ).open();
              }),
            ),
      )
      .addSetting(
        setting =>
          void setting.addButton(button =>
            button
              .setButtonText('Done')
              .setCta()
              .onClick(() => {
                this.render();
              }),
          ),
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}
