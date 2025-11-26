import { App, PluginSettingTab, Setting } from 'obsidian';
import MobilePlugin from './main';

export interface MobilePluginSettings {
	homeFolder: string;
}

export const DEFAULT_SETTINGS: MobilePluginSettings = {
	homeFolder: ''
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
			.addText(text => text
				.setPlaceholder('folder/path')
				.setValue(this.plugin.settings.homeFolder)
				.onChange(async (value) => {
					this.plugin.settings.homeFolder = value;
					await this.plugin.saveSettings();
				}));
	}
}
