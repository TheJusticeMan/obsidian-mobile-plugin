import { App, PluginSettingTab, Setting, FuzzySuggestModal, TFolder } from 'obsidian';
import MobilePlugin from './main';

export interface MobilePluginSettings {
	homeFolder: string;
}

export const DEFAULT_SETTINGS: MobilePluginSettings = {
	homeFolder: ''
}

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
		this.folders = app.vault.getAllLoadedFiles().filter(f => f instanceof TFolder) as TFolder[];
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

export class MobileSettingTab extends PluginSettingTab {
	plugin: MobilePlugin;

	constructor(app: App, plugin: MobilePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Home folder')
			.setDesc('Folder where new notes will be created. Leave empty for vault root.')
			.addButton(button => button
				.setButtonText(this.plugin.settings.homeFolder || 'Select folder')
				.onClick(() => {
					new FolderSuggest(this.app, (folder) => {
						this.plugin.settings.homeFolder = folder.path;
						this.plugin.saveSettings();
						button.setButtonText(folder.path);
					}, 'Select a home folder').open();
				}))
			.addExtraButton(button => button
				.setIcon('cross')
				.setTooltip('Clear folder')
				.onClick(async () => {
					this.plugin.settings.homeFolder = '';
					await this.plugin.saveSettings();
					this.display();
				}));
	}
}
