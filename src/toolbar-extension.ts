import { ViewPlugin, EditorView, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { App } from 'obsidian';
import { ToolbarConfig, ContextBinding, ContextType } from './settings';

/**
 * Creates a CodeMirror 6 ViewPlugin that displays a context-aware toolbar at the bottom
 * when text is selected or cursor is in a specific context.
 */
export function createToolbarExtension(app: App, toolbars: ToolbarConfig[], contextBindings: ContextBinding[], useIcons: boolean, commandIcons: Record<string, string>) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			tooltip: HTMLElement | null = null;
			app: App;
			toolbars: ToolbarConfig[];
			contextBindings: ContextBinding[];
			useIcons: boolean;
			commandIcons: Record<string, string>;
			editorContainer: HTMLElement | null = null;

			constructor(view: EditorView) {
				this.decorations = Decoration.none;
				this.app = app;
				this.toolbars = toolbars;
				this.contextBindings = contextBindings;
				this.useIcons = useIcons;
				this.commandIcons = commandIcons;
				
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
				// Check if any binding matches the current context
				for (const binding of this.contextBindings) {
					if (this.matchesContextType(binding.contextType, view, pos)) {
						return true;
					}
				}
				return false;
			}

			getActiveToolbar(view: EditorView, pos: number): ToolbarConfig | null {
				// Collect all matching toolbars and concatenate their commands
				const matchingToolbars: ToolbarConfig[] = [];
				const seenCommands = new Set<string>();
				
				for (const binding of this.contextBindings) {
					if (this.matchesContextType(binding.contextType, view, pos)) {
						const toolbar = this.toolbars.find(t => t.id === binding.toolbarId);
						if (toolbar) {
							matchingToolbars.push(toolbar);
						}
					}
				}
				
				// If no matches, return null
				if (matchingToolbars.length === 0) {
					return null;
				}
				
				// Concatenate commands from all matching toolbars, removing duplicates
				const combinedCommands: string[] = [];
				for (const toolbar of matchingToolbars) {
					for (const command of toolbar.commands) {
						if (!seenCommands.has(command)) {
							seenCommands.add(command);
							combinedCommands.push(command);
						}
					}
				}
				
				// Return a virtual toolbar with combined commands
				return {
					id: 'combined',
					name: 'Combined Toolbar',
					commands: combinedCommands,
				};
			}

			matchesContextType(contextType: ContextType, view: EditorView, pos: number): boolean {
				const selection = view.state.selection.main;
				
				switch (contextType) {
					case 'selection':
						return !selection.empty;
					
					case 'list':
						return this.isInListContext(view, pos);
					
					case 'task':
						return this.isInTaskContext(view, pos);
					
					case 'heading':
						return this.isInHeadingContext(view, pos);
					
					case 'code-block':
						return this.isInCodeBlockContext(view, pos);
					
					case 'table':
						return this.isInTableContext(view, pos);
					
					case 'blockquote':
						return this.isInBlockquoteContext(view, pos);
					
					case 'link':
						return this.isInLinkContext(view, pos);
					
					case 'default':
						// Default context always matches as fallback
						return true;
					
					default:
						return false;
				}
			}

			isInListContext(view: EditorView, pos: number): boolean {
				let hasContext = false;
				
				syntaxTree(view.state).iterate({
					from: pos,
					to: pos,
					enter: (node: any) => {
						const nodeName = node.type.name;
						
						// Check if in a list item using exact node names
						if (nodeName === 'BulletList' || nodeName === 'OrderedList') {
							hasContext = true;
						}
						
						// Check for HyperMD list line classes (Obsidian's styling) - matches any nesting level
						if (nodeName.startsWith('HyperMD-list-line_HyperMD-list-line-')) {
							hasContext = true;
						}
					}
				});
				
				return hasContext;
			}

			isInTaskContext(view: EditorView, pos: number): boolean {
				let hasContext = false;
				
				syntaxTree(view.state).iterate({
					from: pos,
					to: pos,
					enter: (node: any) => {
						const nodeName = node.type.name;
						
						if (nodeName === 'Task') {
							hasContext = true;
						}
						
						// Check for HyperMD task line
						if (nodeName.includes('HyperMD-task-line')) {
							hasContext = true;
						}
					}
				});
				
				return hasContext;
			}

			isInHeadingContext(view: EditorView, pos: number): boolean {
				let hasContext = false;
				
				syntaxTree(view.state).iterate({
					from: pos,
					to: pos,
					enter: (node: any) => {
						const nodeName = node.type.name;
						
						if (nodeName.startsWith('ATXHeading') || nodeName === 'SetextHeading') {
							hasContext = true;
						}
						
						// Check for HyperMD heading
						if (nodeName.startsWith('HyperMD-header')) {
							hasContext = true;
						}
					}
				});
				
				return hasContext;
			}

			isInCodeBlockContext(view: EditorView, pos: number): boolean {
				let hasContext = false;
				
				syntaxTree(view.state).iterate({
					from: pos,
					to: pos,
					enter: (node: any) => {
						const nodeName = node.type.name;
						
						if (nodeName === 'FencedCode' || nodeName === 'CodeBlock') {
							hasContext = true;
						}
						
						// Check for HyperMD code block
						if (nodeName.includes('HyperMD-codeblock')) {
							hasContext = true;
						}
					}
				});
				
				return hasContext;
			}

			isInTableContext(view: EditorView, pos: number): boolean {
				let hasContext = false;
				
				syntaxTree(view.state).iterate({
					from: pos,
					to: pos,
					enter: (node: any) => {
						const nodeName = node.type.name;
						
						if (nodeName === 'Table' || nodeName.startsWith('Table')) {
							hasContext = true;
						}
						
						// Check for HyperMD table
						if (nodeName.includes('HyperMD-table')) {
							hasContext = true;
						}
					}
				});
				
				return hasContext;
			}

			isInBlockquoteContext(view: EditorView, pos: number): boolean {
				let hasContext = false;
				
				syntaxTree(view.state).iterate({
					from: pos,
					to: pos,
					enter: (node: any) => {
						const nodeName = node.type.name;
						
						if (nodeName === 'Blockquote' || nodeName === 'QuoteMark') {
							hasContext = true;
						}
						
						// Check for HyperMD quote
						if (nodeName.includes('HyperMD-quote')) {
							hasContext = true;
						}
					}
				});
				
				return hasContext;
			}

			isInLinkContext(view: EditorView, pos: number): boolean {
				let hasContext = false;
				
				syntaxTree(view.state).iterate({
					from: pos,
					to: pos,
					enter: (node: any) => {
						const nodeName = node.type.name;
						
						if (nodeName === 'Link' || nodeName.includes('link') || nodeName.includes('URL')) {
							hasContext = true;
						}
						
						// Check for HyperMD link
						if (nodeName.includes('HyperMD-link')) {
							hasContext = true;
						}
					}
				});
				
				return hasContext;
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
				tooltip.setAttribute('data-toolbar-id', activeToolbar.id);
				
				// Get all available commands
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const commands = (this.app as any).commands?.commands || {};

				// Add command buttons
				activeToolbar.commands.forEach(commandId => {
					const command = commands[commandId];
					if (command) {
						const button = document.createElement('button');
						button.className = 'mobile-toolbar-button';
						
						// Determine which icon to use
						const customIcon = this.commandIcons[commandId];
						const defaultIcon = command.icon;
						const iconToUse = customIcon || defaultIcon;
						
						if (this.useIcons && iconToUse) {
							// Use icon
							const iconEl = document.createElement('span');
							iconEl.className = 'mobile-toolbar-icon';
							// Use Obsidian's setIcon function to render the icon
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							(this.app as any).setIcon?.(iconEl, iconToUse);
							button.appendChild(iconEl);
							button.setAttribute('aria-label', command.name || commandId);
						} else {
							// Use text
							button.textContent = command.name || commandId;
						}
						
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
