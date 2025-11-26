import {
	App,
	PluginSettingTab,
	Setting,
	FuzzySuggestModal,
	TFolder,
	Command,
	SuggestModal,
	ExtraButtonComponent,
	getIconIds,
} from "obsidian";
import MobilePlugin from "./main";

export interface ToolbarConfig {
	id: string;
	name: string;
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

export interface ContextBinding {
	id: string;
	contextType: ContextType;
	toolbarId: string;
}

export interface MobilePluginSettings {
	homeFolder: string;
	toolbarCommands: string[]; // Deprecated - kept for backward compatibility
	toolbars: ToolbarConfig[];
	contextBindings: ContextBinding[];
	useIcons: boolean;
	commandIcons: Record<string, string>; // Map of command ID to icon name
	enableHapticFeedback: boolean;
}

export const DEFAULT_SETTINGS: MobilePluginSettings = {
	homeFolder: "",
	toolbarCommands: [
		"editor:toggle-bold",
		"editor:toggle-italics",
		"editor:insert-link",
	],
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
			name: "List Actions",
			commands: [
				"editor:toggle-checklist-status",
				"editor:indent-list",
				"editor:unindent-list",
			],
		},
	],
	contextBindings: [
		{
			id: "binding-selection",
			contextType: "selection",
			toolbarId: "formatting",
		},
		{
			id: "binding-list",
			contextType: "list",
			toolbarId: "list-actions",
		},
		{
			id: "binding-default",
			contextType: "default",
			toolbarId: "formatting",
		},
	],
	useIcons: false,
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
	constructor(
		app: App,
		onSubmit: (result: TFolder) => void,
		prompt?: string
	) {
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
		return this.icons.filter((icon) =>
			icon.toLowerCase().includes(lowerQuery)
		);
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
		// @ts-ignore
		this.commands = Object.values(this.app.commands.commands);
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
	plugin: MobilePlugin;

	constructor(app: App, plugin: MobilePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Home folder setting
		new Setting(containerEl)
			.setName("Home folder")
			.setDesc(
				"Folder where new notes will be created. Leave empty for vault root."
			)
			.addButton((button) =>
				button
					.setButtonText(
						this.plugin.settings.homeFolder || "Select folder"
					)
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
			);

		// Use icons setting
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
						// Trigger toolbar refresh
						this.plugin.refreshToolbar();
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

		// Section 1: Define Toolbars
		new Setting(containerEl)
			.setHeading()
			.setName("Toolbar Library")
			.setDesc(
				"Define toolbars with custom command sets. These can be bound to different contexts below."
			);

		// Render all toolbars
		this.plugin.settings.toolbars.forEach((toolbar, toolbarIndex) => {
			this.renderToolbar(containerEl, toolbar, toolbarIndex);
		});

		// Add new toolbar button
		new Setting(containerEl).addButton((button) =>
			button
				.setButtonText("Add new toolbar")
				.setCta()
				.onClick(async () => {
					const newToolbar: ToolbarConfig = {
						id: `toolbar-${Date.now()}`,
						name: `New Toolbar`,
						commands: [],
					};
					this.plugin.settings.toolbars.push(newToolbar);
					await this.plugin.saveSettings();
					this.display();
				})
		);

		// Section 2: Context Bindings
		new Setting(containerEl)
			.setHeading()
			.setName("Context Bindings")
			.setDesc(
				"Bind toolbars to different editing contexts. Multiple toolbars bound to the same context will be automatically concatenated."
			);

		// Render all context bindings
		this.plugin.settings.contextBindings.forEach(
			(binding, bindingIndex) => {
				this.renderContextBinding(containerEl, binding, bindingIndex);
			}
		);

		// Add new binding button
		new Setting(containerEl).addButton((button) =>
			button
				.setButtonText("Add context binding")
				.setCta()
				.onClick(async () => {
					const newBinding: ContextBinding = {
						id: `binding-${Date.now()}`,
						contextType: "default",
						toolbarId: this.plugin.settings.toolbars[0]?.id || "",
					};
					this.plugin.settings.contextBindings.push(newBinding);
					await this.plugin.saveSettings();
					this.display();
				})
		);
	}

	renderToolbar(
		container: HTMLElement,
		toolbar: ToolbarConfig,
		toolbarIndex: number
	) {
		const toolbarSection = container.createDiv("mobile-toolbar-section");

		// Toolbar header with name
		const headerSetting = new Setting(toolbarSection)
			.setName(toolbar.name)
			.setDesc(`ID: ${toolbar.id}`)
			.addText((text) =>
				text
					.setPlaceholder("Toolbar name")
					.setValue(toolbar.name)
					.onChange(async (value) => {
						toolbar.name = value;
						await this.plugin.saveSettings();
					})
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("trash")
					.setTooltip("Delete toolbar")
					.onClick(async () => {
						// Remove toolbar and any bindings using it
						this.plugin.settings.toolbars.splice(toolbarIndex, 1);
						this.plugin.settings.contextBindings =
							this.plugin.settings.contextBindings.filter(
								(b) => b.toolbarId !== toolbar.id
							);
						await this.plugin.saveSettings();
						this.display();
					})
			);

		headerSetting.settingEl.addClass("mobile-toolbar-header");

		// Command list for this toolbar
		const commandListContainer = toolbarSection.createDiv(
			"mobile-command-list"
		);
		this.renderCommandListForToolbar(
			commandListContainer,
			toolbar,
			toolbarIndex
		);

		// Add command button for this toolbar
		new Setting(toolbarSection).addButton((button) =>
			button
				.setButtonText("Add command")
				.setClass("mobile-add-command-btn")
				.onClick(() => {
					new CommandSuggestModal(this.app, async (command) => {
						toolbar.commands.push(command.id);
						await this.plugin.saveSettings();
						this.renderCommandListForToolbar(
							commandListContainer,
							toolbar,
							toolbarIndex
						);
					}).open();
				})
		);
	}

	renderContextBinding(
		container: HTMLElement,
		binding: ContextBinding,
		bindingIndex: number
	) {
		const toolbar = this.plugin.settings.toolbars.find(
			(t) => t.id === binding.toolbarId
		);
		const toolbarName = toolbar ? toolbar.name : "(Not found)";

		const setting = new Setting(container)
			.setName(
				`${this.getContextDisplayName(
					binding.contextType
				)} → ${toolbarName}`
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("selection", "Selection")
					.addOption("list", "List")
					.addOption("task", "Task")
					.addOption("heading", "Heading")
					.addOption("code-block", "Code Block")
					.addOption("table", "Table")
					.addOption("blockquote", "Blockquote")
					.addOption("link", "Link")
					.addOption("default", "Default")
					.setValue(binding.contextType)
					.onChange(async (value) => {
						binding.contextType = value as ContextType;
						await this.plugin.saveSettings();
						this.display();
					});
			})
			.addDropdown((dropdown) => {
				this.plugin.settings.toolbars.forEach((toolbar) => {
					dropdown.addOption(toolbar.id, toolbar.name);
				});
				dropdown.setValue(binding.toolbarId).onChange(async (value) => {
					binding.toolbarId = value;
					await this.plugin.saveSettings();
					this.display();
				});
			})
			.addExtraButton((btn) =>
				btn
					.setIcon("trash")
					.setTooltip("Delete binding")
					.onClick(async () => {
						this.plugin.settings.contextBindings.splice(
							bindingIndex,
							1
						);
						await this.plugin.saveSettings();
						this.display();
					})
			);
	}

	getContextDisplayName(contextType: ContextType): string {
		const names: Record<ContextType, string> = {
			selection: "Selection",
			list: "List",
			task: "Task",
			heading: "Heading",
			"code-block": "Code Block",
			table: "Table",
			blockquote: "Blockquote",
			link: "Link",
			default: "Default",
		};
		return names[contextType] || contextType;
	}

	renderCommandListForToolbar(
		container: HTMLElement,
		toolbar: ToolbarConfig,
		toolbarIndex: number
	) {
		container.empty();
		const commands = toolbar.commands;

		commands.forEach((cmdId, index) => {
			// @ts-ignore
			const command = this.app.commands.findCommand(cmdId);
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
								this.renderCommandListForToolbar(
									container,
									toolbar,
									toolbarIndex
								);
							}).open();
						})
				)
				.addExtraButton((btn) =>
					btn
						.setIcon("pencil")
						.setTooltip("Change command")
						.onClick(async () => {
							new CommandSuggestModal(
								this.app,
								async (command) => {
									toolbar.commands[index] = command.id;
									await this.plugin.saveSettings();
									this.renderCommandListForToolbar(
										container,
										toolbar,
										toolbarIndex
									);
								}
							).open();
						})
				)
				.addExtraButton((btn) =>
					btn
						.setIcon("trash")
						.setTooltip("Remove command")
						.onClick(async () => {
							toolbar.commands.splice(index, 1);
							await this.plugin.saveSettings();
							this.renderCommandListForToolbar(
								container,
								toolbar,
								toolbarIndex
							);
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

					const item = toolbar.commands.splice(oldIndex, 1)[0];

					if (oldIndex < targetIndex) {
						targetIndex--;
					}

					toolbar.commands.splice(targetIndex, 0, item);
					await this.plugin.saveSettings();
					this.renderCommandListForToolbar(
						container,
						toolbar,
						toolbarIndex
					);
				}
			};
		});
	}
}
