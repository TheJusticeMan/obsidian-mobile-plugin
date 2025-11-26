import { ViewPlugin, EditorView, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { App } from 'obsidian';

/**
 * Creates a CodeMirror 6 ViewPlugin that displays a context-aware toolbar at the bottom
 * when text is selected or cursor is in a specific context.
 */
export function createToolbarExtension(app: App, commandIds: string[]) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			tooltip: HTMLElement | null = null;
			app: App;
			commandIds: string[];
			editorContainer: HTMLElement | null = null;

			constructor(view: EditorView) {
				this.decorations = Decoration.none;
				this.app = app;
				this.commandIds = commandIds;
				
				// Find the editor container to anchor the toolbar
				this.editorContainer = this.findEditorContainer(view.dom);
				
				this.updateTooltip(view);
			}

			findEditorContainer(element: HTMLElement): HTMLElement | null {
				// Find the workspace-leaf-content container
				let current = element.parentElement;
				while (current) {
					if (current.classList.contains('workspace-leaf-content')) {
						return current;
					}
					current = current.parentElement;
				}
				return null;
			}

			update(update: ViewUpdate) {
				if (update.selectionSet || update.viewportChanged || update.docChanged) {
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

				// Show toolbar if there's a selection or cursor is in specific context
				if (!selection.empty || this.hasContext(view, selection.from)) {
					this.showTooltip(view);
				}
			}

			hasContext(view: EditorView, pos: number): boolean {
				// Check if cursor is in a markdown list or other special context using syntax tree
				const tree = syntaxTree(view.state);
				const node = tree.resolveInner(pos, 0);
				
				// Check for list context
				if (node.type.name.includes('list')) {
					return true;
				}
				
				// Check for task list context
				if (node.type.name.includes('task')) {
					return true;
				}
				
				return false;
			}

			getContextCommands(view: EditorView, pos: number): string[] {
				const selection = view.state.selection.main;
				const tree = syntaxTree(view.state);
				const node = tree.resolveInner(pos, 0);
				
				// If there's a selection, show formatting commands
				if (!selection.empty) {
					return this.commandIds;
				}
				
				// Context-based commands for cursor position
				const contextCommands: string[] = [];
				
				// Check if in a list item using syntax tree
				if (node.type.name.includes('list')) {
					contextCommands.push('editor:toggle-checklist-status');
					contextCommands.push('editor:indent-list');
					contextCommands.push('editor:unindent-list');
				}
				
				// If no specific context, show default commands
				return contextCommands.length > 0 ? contextCommands : this.commandIds;
			}

			showTooltip(view: EditorView) {
				const selection = view.state.selection.main;
				
				// Create tooltip element
				const tooltip = document.createElement('div');
				tooltip.className = 'mobile-selection-toolbar';
				
				// Get all available commands
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const commands = (this.app as any).commands?.commands || {};

				// Get context-aware commands
				const activeCommands = this.getContextCommands(view, selection.from);

				// Add command buttons
				activeCommands.forEach(commandId => {
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

				// Position toolbar at bottom of editor container
				tooltip.style.position = 'absolute';
				tooltip.style.bottom = 'calc(10px + env(safe-area-inset-bottom))';
				tooltip.style.left = '50%';
				tooltip.style.transform = 'translateX(-50%)';
				tooltip.style.zIndex = '1000';

				// Store reference and append to editor container
				this.tooltip = tooltip;
				if (this.editorContainer) {
					this.editorContainer.appendChild(tooltip);
				} else {
					view.dom.appendChild(tooltip);
				}
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
