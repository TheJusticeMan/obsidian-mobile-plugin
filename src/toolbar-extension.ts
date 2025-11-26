import { ViewPlugin, EditorView, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { App } from 'obsidian';
import { ToolbarConfig } from './settings';

/**
 * Creates a CodeMirror 6 ViewPlugin that displays a context-aware toolbar at the bottom
 * when text is selected or cursor is in a specific context.
 */
export function createToolbarExtension(app: App, toolbars: ToolbarConfig[]) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			tooltip: HTMLElement | null = null;
			app: App;
			toolbars: ToolbarConfig[];
			editorContainer: HTMLElement | null = null;

			constructor(view: EditorView) {
				this.decorations = Decoration.none;
				this.app = app;
				this.toolbars = toolbars;
				
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
				const selection = view.state.selection.main;
				
				// Check if any toolbar matches the current context
				for (const toolbar of this.toolbars) {
					if (this.matchesToolbarContext(toolbar, view, pos, selection)) {
						return true;
					}
				}
				
				// Always show default toolbar if configured
				return this.toolbars.some(t => t.context === 'default');
			}

			getActiveToolbar(view: EditorView, pos: number): ToolbarConfig | null {
				const selection = view.state.selection.main;
				
				// Check each toolbar to find the first matching context
				for (const toolbar of this.toolbars) {
					if (this.matchesToolbarContext(toolbar, view, pos, selection)) {
						return toolbar;
					}
				}
				
				// Fallback to default toolbar
				return this.toolbars.find(t => t.context === 'default') || null;
			}

			matchesToolbarContext(toolbar: ToolbarConfig, view: EditorView, pos: number, selection: { empty: boolean }): boolean {
				switch (toolbar.context) {
					case 'selection':
						return !selection.empty;
					
					case 'list':
						return this.isInListContext(view, pos);
					
					case 'default':
						// Default toolbar is the fallback
						return false;
					
					case 'custom':
						// Custom context logic could be implemented here
						return false;
					
					default:
						return false;
				}
			}

			isInListContext(view: EditorView, pos: number): boolean {
				let hasListContext = false;
				
				syntaxTree(view.state).iterate({
					from: pos,
					to: pos,
					enter: (node) => {
						const nodeName = node.type.name;
						
						// Check if in a list item using exact node names
						if (nodeName === 'BulletList' || nodeName === 'OrderedList' || nodeName === 'Task') {
							hasListContext = true;
						}
						
						// Check for HyperMD list line classes (Obsidian's styling) - matches any nesting level
						if (nodeName.startsWith('HyperMD-list-line_HyperMD-list-line-')) {
							hasListContext = true;
						}
					}
				});
				
				return hasListContext;
			}

			showTooltip(view: EditorView) {
				const selection = view.state.selection.main;
				
				// Get the active toolbar based on context
				const activeToolbar = this.getActiveToolbar(view, selection.from);
				
				if (!activeToolbar || activeToolbar.commands.length === 0) {
					return;
				}
				
				// Create tooltip element
				const tooltip = document.createElement('div');
				tooltip.className = 'mobile-selection-toolbar';
				tooltip.setAttribute('data-toolbar-context', activeToolbar.context);
				
				// Get all available commands
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const commands = (this.app as any).commands?.commands || {};

				// Add command buttons
				activeToolbar.commands.forEach(commandId => {
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
