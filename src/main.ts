import { Plugin, TFile, normalizePath } from 'obsidian';
import { FABManager } from './fab';
import { createToolbarExtension } from './toolbar-extension';
import { MobilePluginSettings, DEFAULT_SETTINGS, MobileSettingTab } from './settings';

export default class MobilePlugin extends Plugin {
	settings: MobilePluginSettings;
	fabManager: FABManager | null = null;

	async onload() {
		await this.loadSettings();

		// Register command for creating new notes
		this.addCommand({
			id: 'create-new-note',
			name: 'Create new note',
			callback: async () => {
				await this.createNewNote();
			}
		});

		// Initialize FAB Manager
		this.fabManager = new FABManager(this.app, this.settings);

		// Update FAB when workspace layout changes
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.fabManager?.updateActiveLeaf();
			})
		);

		// Initial FAB setup
		this.app.workspace.onLayoutReady(() => {
			this.fabManager?.updateActiveLeaf();
		});

		// Register the CodeMirror 6 toolbar extension with multiple context-aware toolbars
		this.registerEditorExtension(createToolbarExtension(this.app, this.settings.toolbars));

		// Add settings tab
		this.addSettingTab(new MobileSettingTab(this.app, this));
	}

	async createNewNote() {
		try {
			// Determine the folder path
			const folderPath = this.settings.homeFolder ? normalizePath(this.settings.homeFolder) : '';
			
			// Ensure the folder exists
			if (folderPath && !(await this.app.vault.adapter.exists(folderPath))) {
				await this.app.vault.createFolder(folderPath);
			}

			// Find an available filename
			let filename = 'Untitled.md';
			let counter = 1;
			let fullPath = folderPath ? `${folderPath}/Untitled.md` : 'Untitled.md';
			
			while (await this.app.vault.adapter.exists(fullPath)) {
				filename = `Untitled ${counter}.md`;
				fullPath = folderPath ? `${folderPath}/${filename}` : filename;
				counter++;
			}

			// Create the file
			const file = await this.app.vault.create(fullPath, '');

			// Open the newly created file
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file as TFile);
		} catch (error) {
			console.error('Error creating note:', error);
		}
	}

	onunload() {
		// Clean up FAB manager
		if (this.fabManager) {
			this.fabManager.destroy();
			this.fabManager = null;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
