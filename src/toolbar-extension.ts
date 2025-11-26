import { ViewPlugin, EditorView, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';

/**
 * Creates a CodeMirror 6 ViewPlugin that displays a toolbar tooltip
 * when text is selected in the editor.
 */
export const toolbarExtension = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		tooltip: HTMLElement | null = null;

		constructor(view: EditorView) {
			this.decorations = Decoration.none;
			this.updateTooltip(view);
		}

		update(update: ViewUpdate) {
			if (update.selectionSet || update.viewportChanged) {
				this.updateTooltip(update.view);
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
			const selection = view.state.selection.main;
			
			// Get coordinates of the selection
			const startCoords = view.coordsAtPos(selection.from);
			const endCoords = view.coordsAtPos(selection.to);
			
			if (!startCoords || !endCoords) return;

			// Create tooltip element
			this.tooltip = document.createElement('div');
			this.tooltip.className = 'mobile-selection-toolbar';
			
			// Add action buttons
			const actions = [
				{ label: 'Bold', action: () => this.wrapSelection(view, '**', '**') },
				{ label: 'Italic', action: () => this.wrapSelection(view, '_', '_') },
				{ label: 'Link', action: () => this.wrapSelection(view, '[', '](url)') }
			];

			actions.forEach(({ label, action }) => {
				const button = document.createElement('button');
				button.textContent = label;
				button.className = 'mobile-toolbar-button';
				button.addEventListener('click', (e) => {
					e.preventDefault();
					action();
				});
				if (this.tooltip) {
					this.tooltip.appendChild(button);
				}
			});

			// Position tooltip above the selection
			const left = startCoords.left;
			const top = startCoords.top - 40; // Position above selection

			this.tooltip.style.position = 'absolute';
			this.tooltip.style.left = `${left}px`;
			this.tooltip.style.top = `${top}px`;
			this.tooltip.style.zIndex = '1000';

			// Append to document
			document.body.appendChild(this.tooltip);
		}

		wrapSelection(view: EditorView, before: string, after: string) {
			const selection = view.state.selection.main;
			const selectedText = view.state.doc.sliceString(selection.from, selection.to);
			
			view.dispatch({
				changes: {
					from: selection.from,
					to: selection.to,
					insert: `${before}${selectedText}${after}`
				},
				selection: {
					anchor: selection.from + before.length,
					head: selection.to + before.length
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
