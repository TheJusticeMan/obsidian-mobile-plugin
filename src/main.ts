import { Plugin } from 'obsidian';
import { mountFAB } from './fab';
import { toolbarExtension } from './toolbar-extension';
import { MobilePluginSettings, DEFAULT_SETTINGS, MobileSettingTab } from './settings';

export default class MobilePlugin extends Plugin {
	settings: MobilePluginSettings;
	fabElement: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		// Mount the Floating Action Button
		this.fabElement = mountFAB(this.app, document.body, this.settings);

		// Register the CodeMirror 6 toolbar extension
		this.registerEditorExtension(toolbarExtension);

		// Add settings tab
		this.addSettingTab(new MobileSettingTab(this.app, this));
	}

	onunload() {
		// Clean up the FAB element
		if (this.fabElement) {
			this.fabElement.remove();
			this.fabElement = null;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
