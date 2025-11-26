import { ViewPlugin, EditorView, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { App } from 'obsidian';

/**
 * Creates a CodeMirror 6 ViewPlugin that displays a toolbar at the bottom
 * when text is selected in the editor.
 */
export function createToolbarExtension(app: App, commandIds: string[]) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			tooltip: HTMLElement | null = null;
			app: App;
			commandIds: string[];

			constructor(view: EditorView) {
				this.decorations = Decoration.none;
				this.app = app;
				this.commandIds = commandIds;
				this.updateTooltip(view);
			}

			update(update: ViewUpdate) {
				if (update.selectionSet || update.viewportChanged) {
					// Defer tooltip update to avoid reading layout during update
					requestAnimationFrame(() => {
						this.updateTooltip(update.view);
					});
				}
			}

			updateTooltip(view: EditorView) {
				const selection = view.state.selection.main;
				
				// Remove existing tooltip if present
				if (this.tooltip) {
					this.tooltip.remove();
					this.tooltip = null;
				}

				// Only show tooltip if there's a non-empty selection
				if (!selection.empty) {
					this.showTooltip(view);
				}
			}

			showTooltip(view: EditorView) {
				// Create tooltip element
				const tooltip = document.createElement('div');
				tooltip.className = 'mobile-selection-toolbar';
				
				// Get all available commands
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const commands = (this.app as any).commands?.commands || {};

				// Add command buttons
				this.commandIds.forEach(commandId => {
					const command = commands[commandId];
					if (command) {
						const button = document.createElement('button');
						button.textContent = command.name || commandId;
						button.className = 'mobile-toolbar-button';
						button.addEventListener('click', (e) => {
							e.preventDefault();
							// Execute the command
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							(this.app as any).commands?.executeCommandById(commandId);
						});
						tooltip.appendChild(button);
					}
				});

				// Position toolbar at bottom of viewport (above keyboard on mobile)
				tooltip.style.position = 'fixed';
				tooltip.style.bottom = 'calc(10px + env(safe-area-inset-bottom))';
				tooltip.style.left = '50%';
				tooltip.style.transform = 'translateX(-50%)';
				tooltip.style.zIndex = '1000';

				// Store reference and append to document
				this.tooltip = tooltip;
				document.body.appendChild(tooltip);
			}

			destroy() {
				if (this.tooltip) {
					this.tooltip.remove();
					this.tooltip = null;
				}
			}
		},
		{
			// No decorations needed for this plugin
		}
	);
}
