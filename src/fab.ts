import { App, TFile, normalizePath, WorkspaceLeaf } from 'obsidian';
import { MobilePluginSettings } from './settings';

/**
 * Manages FAB placement and lifecycle across editor leaves.
 */
export class FABManager {
	private app: App;
	private settings: MobilePluginSettings;
	private fabElements: Map<WorkspaceLeaf, HTMLElement> = new Map();

	constructor(app: App, settings: MobilePluginSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Updates FAB for the active leaf
	 */
	updateActiveLeaf() {
		const activeLeaf = this.app.workspace.activeLeaf;
		if (activeLeaf) {
			this.ensureFABForLeaf(activeLeaf);
		}
	}

	/**
	 * Ensures a FAB exists for the given leaf
	 */
	private ensureFABForLeaf(leaf: WorkspaceLeaf) {
		// Check if this leaf is a markdown editor
		const view = leaf.view;
		if (view.getViewType() !== 'markdown') {
			return;
		}

		// Don't create duplicate FABs
		if (this.fabElements.has(leaf)) {
			return;
		}

		// The containerEl is already the workspace-leaf-content
		const leafContent = leaf.view.containerEl;
		if (!leafContent) {
			return;
		}

		// Create and mount FAB
		const fab = this.createFAB();
		leafContent.appendChild(fab);
		this.fabElements.set(leaf, fab);
	}

	/**
	 * Creates a FAB element
	 */
	private createFAB(): HTMLElement {
		const fab = document.createElement('button');
		fab.className = 'mobile-fab';
		fab.setAttribute('aria-label', 'Create new note (long press for command palette)');

		// Add plus icon
		fab.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

		// Variables for long press detection
		let pressTimer: NodeJS.Timeout | null = null;
		let isLongPress = false;

		// Touch/Mouse start
		const startPress = () => {
			isLongPress = false;
			pressTimer = setTimeout(() => {
				isLongPress = true;
				// Haptic feedback for long press
				this.hapticFeedback(20);
				// Open command palette
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(this.app as any).commands?.executeCommandById('command-palette:open');
			}, 500);
		};

		// Touch/Mouse end
		const endPress = async () => {
			if (pressTimer) {
				clearTimeout(pressTimer);
				pressTimer = null;
			}

			// Only create note if it wasn't a long press
			if (!isLongPress) {
				this.hapticFeedback(10);
				await this.createNewNote();
			}
		};

		// Cancel on mouse/touch leave
		const cancelPress = () => {
			if (pressTimer) {
				clearTimeout(pressTimer);
				pressTimer = null;
			}
			isLongPress = false;
		};

		// Add event listeners for both touch and mouse
		fab.addEventListener('touchstart', startPress);
		fab.addEventListener('mousedown', startPress);
		
		fab.addEventListener('touchend', endPress);
		fab.addEventListener('mouseup', endPress);
		
		fab.addEventListener('touchcancel', cancelPress);
		fab.addEventListener('mouseleave', cancelPress);

		return fab;
	}

	/**
	 * Triggers haptic feedback if enabled and supported
	 */
	private hapticFeedback(duration: number = 10) {
		if (this.settings.enableHapticFeedback && navigator.vibrate) {
			navigator.vibrate(duration);
		}
	}

	/**
	 * Creates a new note
	 */
	private async createNewNote() {
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

			// Auto-focus into the editor
			setTimeout(() => {
				this.app.workspace.activeEditor?.editor?.focus();
			}, 100);
		} catch (error) {
			console.error('Error creating note:', error);
		}
	}

	/**
	 * Cleans up all FABs
	 */
	destroy() {
		this.fabElements.forEach(fab => fab.remove());
		this.fabElements.clear();
	}
}
