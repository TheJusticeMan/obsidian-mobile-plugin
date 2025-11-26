import { Plugin } from 'obsidian';
import { mountFAB } from './fab';
import { toolbarExtension } from './toolbar-extension';

export default class MobilePlugin extends Plugin {
	fabElement: HTMLElement | null = null;

	async onload() {
		// Mount the Floating Action Button
		this.fabElement = mountFAB(this.app, document.body);

		// Register the CodeMirror 6 toolbar extension
		this.registerEditorExtension(toolbarExtension);
	}

	onunload() {
		// Clean up the FAB element
		if (this.fabElement) {
			this.fabElement.remove();
			this.fabElement = null;
		}
	}
}
