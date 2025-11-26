import {
	App,
	PluginSettingTab,
	Setting,
	FuzzySuggestModal,
	TFolder,
	Command,
} from "obsidian";
import MobilePlugin from "./main";

export type { ToolbarConfig };

export interface ToolbarConfig {
	id: string;
	name: string;
	context: 'selection' | 'list' | 'default' | 'custom';
	commands: string[];
	customContextCheck?: string; // Optional custom context detection logic
}

export interface MobilePluginSettings {
	homeFolder: string;
	toolbarCommands: string[]; // Deprecated - kept for backward compatibility
	toolbars: ToolbarConfig[];
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
			id: 'selection',
			name: 'Selection Toolbar',
			context: 'selection',
			commands: [
				"editor:toggle-bold",
				"editor:toggle-italics",
				"editor:insert-link",
			],
		},
		{
			id: 'list',
			name: 'List Toolbar',
			context: 'list',
			commands: [
				"editor:toggle-checklist-status",
				"editor:indent-list",
				"editor:unindent-list",
			],
		},
		{
			id: 'default',
			name: 'Default Toolbar',
			context: 'default',
			commands: [
				"editor:toggle-bold",
				"editor:toggle-italics",
				"editor:insert-link",
			],
		},
	],
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

		new Setting(containerEl)
			.setHeading()
			.setName("Toolbars")
			.setDesc(
				"Configure multiple context-aware toolbars. Each toolbar shows different commands based on the editing context."
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
						context: 'default',
						commands: [],
					};
					this.plugin.settings.toolbars.push(newToolbar);
					await this.plugin.saveSettings();
					this.display();
				})
		);
	}

	renderToolbar(container: HTMLElement, toolbar: ToolbarConfig, toolbarIndex: number) {
		const toolbarSection = container.createDiv('mobile-toolbar-section');
		
		// Toolbar header with name and context
		const headerSetting = new Setting(toolbarSection)
			.setName(toolbar.name)
			.setDesc(`Context: ${toolbar.context}`)
			.addText((text) =>
				text
					.setPlaceholder("Toolbar name")
					.setValue(toolbar.name)
					.onChange(async (value) => {
						toolbar.name = value;
						await this.plugin.saveSettings();
					})
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption('selection', 'Selection')
					.addOption('list', 'List')
					.addOption('default', 'Default')
					.addOption('custom', 'Custom')
					.setValue(toolbar.context)
					.onChange(async (value) => {
						toolbar.context = value as ToolbarConfig['context'];
						await this.plugin.saveSettings();
						this.display();
					})
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("trash")
					.setTooltip("Delete toolbar")
					.onClick(async () => {
						this.plugin.settings.toolbars.splice(toolbarIndex, 1);
						await this.plugin.saveSettings();
						this.display();
					})
			);

		headerSetting.settingEl.addClass('mobile-toolbar-header');

		// Command list for this toolbar
		const commandListContainer = toolbarSection.createDiv('mobile-command-list');
		this.renderCommandListForToolbar(commandListContainer, toolbar, toolbarIndex);

		// Add command button for this toolbar
		new Setting(toolbarSection)
			.addButton((button) =>
				button
					.setButtonText("Add command")
					.setClass('mobile-add-command-btn')
					.onClick(() => {
						new CommandSuggestModal(this.app, async (command) => {
							toolbar.commands.push(command.id);
							await this.plugin.saveSettings();
							this.renderCommandListForToolbar(commandListContainer, toolbar, toolbarIndex);
						}).open();
					})
			);
	}

	renderCommandListForToolbar(container: HTMLElement, toolbar: ToolbarConfig, toolbarIndex: number) {
		container.empty();
		const commands = toolbar.commands;

		commands.forEach((cmdId, index) => {
			// @ts-ignore
			const command = this.app.commands.findCommand(cmdId);
			const commandName = command ? command.name : cmdId;

			const setting = new Setting(container)
				.setName(commandName)
				.setDesc(cmdId)
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
									this.renderCommandListForToolbar(container, toolbar, toolbarIndex);
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
							this.renderCommandListForToolbar(container, toolbar, toolbarIndex);
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
					this.renderCommandListForToolbar(container, toolbar, toolbarIndex);
				}
			};
		});
	}

}
