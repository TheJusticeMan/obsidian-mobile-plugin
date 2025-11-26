import { App, TFile } from 'obsidian';

/**
 * Mounts a Floating Action Button (FAB) that creates new notes.
 * The FAB is positioned at the bottom-right with safe area insets for mobile devices.
 */
export function mountFAB(app: App, containerEl: HTMLElement): HTMLElement {
	const fab = containerEl.createEl('button', {
		cls: 'mobile-fab',
		attr: {
			'aria-label': 'Create new note'
		}
	});

	// Add plus icon
	fab.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

	fab.addEventListener('click', async () => {
		try {
			// Find an available filename
			let filename = 'Untitled.md';
			let counter = 1;
			
			while (await app.vault.adapter.exists(filename)) {
				filename = `Untitled ${counter}.md`;
				counter++;
			}

			// Create the file
			const file = await app.vault.create(filename, '');

			// Open the newly created file
			const leaf = app.workspace.getLeaf(false);
			await leaf.openFile(file as TFile);
		} catch (error) {
			console.error('Error creating note:', error);
		}
	});

	return fab;
}
