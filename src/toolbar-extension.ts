import {
	ViewPlugin,
	EditorView,
	ViewUpdate,
	Decoration,
	DecorationSet,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { App, ButtonComponent } from "obsidian";
import { ToolbarConfig, ContextBinding, ContextType } from "./settings";

/**
 * Creates a CodeMirror 6 ViewPlugin that displays a context-aware toolbar at the bottom
 * when text is selected or cursor is in a specific context.
 */
export function createToolbarExtension(
	app: App,
	toolbars: ToolbarConfig[],
	contextBindings: ContextBinding[],
	useIcons: boolean,
	commandIcons: Record<string, string>
) {
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
					if (current.classList.contains("workspace-leaf-content")) {
						return current;
					}
					current = current.parentElement;
				}
				return null;
			}

			update(update: ViewUpdate) {
				if (
					update.selectionSet ||
					update.viewportChanged ||
					update.docChanged
				) {
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
				const activeContexts = this.getMatchingContexts(view, pos);
				// Check if any binding matches the current context
				for (const binding of this.contextBindings) {
					if (activeContexts.has(binding.contextType)) {
						return true;
					}
				}
				return false;
			}

			getActiveToolbar(
				view: EditorView,
				pos: number
			): ToolbarConfig | null {
				const activeContexts = this.getMatchingContexts(view, pos);
				// Collect all matching toolbars and concatenate their commands
				const matchingToolbars: ToolbarConfig[] = [];
				const seenCommands = new Set<string>();

				for (const binding of this.contextBindings) {
					if (activeContexts.has(binding.contextType)) {
						const toolbar = this.toolbars.find(
							(t) => t.id === binding.toolbarId
						);
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
					id: "combined",
					name: "Combined Toolbar",
					commands: combinedCommands,
				};
			}

			getMatchingContexts(
				view: EditorView,
				pos: number
			): Set<ContextType> {
				const contexts = new Set<ContextType>();
				contexts.add("default");

				if (!view.state.selection.main.empty) {
					contexts.add("selection");
				}

				syntaxTree(view.state).iterate({
					from: pos,
					to: pos,
					enter: (node: any) => {
						const nodeName = node.type.name;

						if (
							nodeName === "BulletList" ||
							nodeName === "OrderedList" ||
							nodeName.startsWith(
								"HyperMD-list-line_HyperMD-list-line-"
							)
						) {
							contexts.add("list");
						}

						if (
							nodeName === "Task" ||
							nodeName.includes("HyperMD-task-line")
						) {
							contexts.add("task");
						}

						if (
							nodeName.startsWith("ATXHeading") ||
							nodeName === "SetextHeading" ||
							nodeName.startsWith("HyperMD-header")
						) {
							contexts.add("heading");
						}

						if (
							nodeName === "FencedCode" ||
							nodeName === "CodeBlock" ||
							nodeName.includes("HyperMD-codeblock")
						) {
							contexts.add("code-block");
						}

						if (
							nodeName === "Table" ||
							nodeName.startsWith("Table") ||
							nodeName.includes("HyperMD-table")
						) {
							contexts.add("table");
						}

						if (
							nodeName === "Blockquote" ||
							nodeName === "QuoteMark" ||
							nodeName.includes("HyperMD-quote")
						) {
							contexts.add("blockquote");
						}

						if (
							nodeName === "Link" ||
							nodeName.includes("link") ||
							nodeName.includes("URL") ||
							nodeName.includes("HyperMD-link")
						) {
							contexts.add("link");
						}
					},
				});

				return contexts;
			}

			showTooltip(view: EditorView) {
				const selection = view.state.selection.main;

				// Get the active toolbar based on context
				const activeToolbar = this.getActiveToolbar(
					view,
					selection.from
				);

				if (!activeToolbar || activeToolbar.commands.length === 0) {
					return;
				}

				// Create tooltip element
				this.tooltip = (this.editorContainer || view.dom).createDiv({
					cls: "mobile-selection-toolbar",
					attr: { "data-toolbar-id": activeToolbar.id },
				});

				// Get all available commands
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const commands = (this.app as any).commands?.commands || {};

				// Add command buttons
				activeToolbar.commands.forEach((commandId) => {
					const command = commands[commandId];
					const iconToUse =
						this.commandIcons[commandId] || command.icon;
					if (command) {
						if (this.useIcons && iconToUse) {
							new ButtonComponent(this.tooltip)
								/* .setClass("mobile-toolbar-button") */
								.setIcon(iconToUse)
								.setTooltip(command.name || commandId)
								.onClick((e) => {
									// Execute the command
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
									(
										this.app as any
									).commands?.executeCommandById(commandId);
								});
						} else {
							new ButtonComponent(this.tooltip)
								/* .setClass("mobile-toolbar-button") */
								.setButtonText(command.name || commandId)
								.setTooltip(command.name || commandId)
								.onClick((e) => {
									// Execute the command
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
									(
										this.app as any
									).commands?.executeCommandById(commandId);
								});
						}
					}
				});
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
