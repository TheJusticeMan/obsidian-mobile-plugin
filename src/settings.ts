import {
	App,
	PluginSettingTab,
	Setting,
	FuzzySuggestModal,
	TFolder,
	Command,
} from "obsidian";
import MobilePlugin from "./main";

export interface MobilePluginSettings {
	homeFolder: string;
	toolbarCommands: string[];
}

export const DEFAULT_SETTINGS: MobilePluginSettings = {
	homeFolder: "",
	toolbarCommands: [
		"editor:toggle-bold",
		"editor:toggle-italics",
		"editor:insert-link",
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
			.setName("Toolbar commands")
			.setDesc(
				"Manage commands that appear in the mobile toolbar. Drag to reorder."
			);

		const commandListContainer = containerEl.createDiv();
		this.renderCommandList(commandListContainer);

		new Setting(containerEl).addButton((button) =>
			button
				.setButtonText("Add command")
				.setCta()
				.onClick(() => {
					new CommandSuggestModal(this.app, async (command) => {
						this.plugin.settings.toolbarCommands.push(command.id);
						await this.plugin.saveSettings();
						this.renderCommandList(commandListContainer);
					}).open();
				})
		);
	}

	renderCommandList(container: HTMLElement) {
		container.empty();
		const commands = this.plugin.settings.toolbarCommands;

		commands.forEach((cmdId, index) => {
			// @ts-ignore
			const command = this.app.commands.findCommand(cmdId);
			const commandName = command ? command.name : cmdId;

			const setting = new Setting(container)
				.setName(commandName)
				.setDesc(cmdId)
				.addExtraButton((btn) =>
					btn.setIcon("trash").onClick(async () => {
						this.plugin.settings.toolbarCommands.splice(index, 1);
						await this.plugin.saveSettings();
						this.renderCommandList(container);
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

					const item = this.plugin.settings.toolbarCommands.splice(
						oldIndex,
						1
					)[0];

					if (oldIndex < targetIndex) {
						targetIndex--;
					}

					this.plugin.settings.toolbarCommands.splice(
						targetIndex,
						0,
						item
					);
					await this.plugin.saveSettings();
					this.renderCommandList(container);
				}
			};
		});
	}
}
