import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import {
  App,
  ButtonComponent,
  ExtraButtonComponent,
  FileView,
  MarkdownView,
  View,
} from 'obsidian';
import { ToolbarEditor } from 'src/views/ToolbarEditor';
import MobilePlugin from '../main';
import { ContextType, ToolbarConfig } from '../settings';

/**
 * Creates a CodeMirror 6 ViewPlugin that displays a context-aware toolbar at the bottom
 * when text is selected or cursor is in a specific context.
 *
 * The toolbar adapts its available commands based on the current editor context:
 * - Selection context: Copy, cut, formatting commands
 * - List context: Indent, bullet/numbered list toggles
 * - Table context: Row/column operations
 * - Code block context: Code formatting commands
 * - And more...
 *
 * Features:
 * - Context detection using CodeMirror syntax tree
 * - Command availability checking
 * - Swipe-to-expand gesture for more commands
 * - Haptic feedback on button presses
 * - Icon or text button display modes
 *
 * @param app - The Obsidian application instance
 * @param plugin - The mobile plugin instance
 * @returns A CodeMirror ViewPlugin for the toolbar
 */
export function createToolbarExtension(app: App, plugin: MobilePlugin) {
  return ViewPlugin.fromClass(
    /**
     * Anonymous ViewPlugin class for context-aware toolbar management.
     *
     * Monitors editor state changes (selection, viewport, document)
     * and updates the toolbar accordingly. Handles toolbar rendering,
     * context detection, and command execution.
     */
    class {
      decorations: DecorationSet;
      app: App;
      plugin: MobilePlugin;
      activeToolbars: ToolbarConfig[] | null = null;
      currentToolbar: ToolbarConfig | null = null;
      view!: EditorView;
      private readonly refreshToolbar = (): void => {
        if (!this.view) {
          return;
        }

        window.requestAnimationFrame(() => this.updateTooltip(this.view));
      };

      constructor(view: EditorView) {
        this.decorations = Decoration.none;
        this.app = app;
        this.plugin = plugin;
        this.view = view;

        window.visualViewport?.addEventListener('resize', this.refreshToolbar);
        window.addEventListener('resize', this.refreshToolbar);
        window.activeDocument.addEventListener('focusin', this.refreshToolbar);
        window.activeDocument.addEventListener('focusout', this.refreshToolbar);

        // Find the editor container to anchor the toolbar

        this.updateTooltip(view);
      }

      get activeView(): View | null {
        return (
          this.app.workspace.getActiveViewOfType(MarkdownView) ||
          this.app.workspace.getActiveViewOfType(FileView)
        );
      }

      /**
       * Add swipe gesture to expand toolbar
       */
      addSwipeToExpandListener(toolbar: HTMLElement): void {
        const SWIPE_THRESHOLD_PX = 30;

        let touchStartY = 0;
        let hasToggled = false;

        plugin.elementsToCleanup.get(toolbar)?.();

        const handleTouchStart = (e: TouchEvent): void => {
          touchStartY = e.touches[0].clientY;
          hasToggled = false;
        };
        toolbar.addEventListener('touchstart', handleTouchStart);

        const handleTouchMove = (e: TouchEvent): void => {
          const touchY = e.touches[0].clientY;
          const deltaY = touchStartY - touchY;

          // If swiped up more than threshold and haven't toggled yet
          if (deltaY > SWIPE_THRESHOLD_PX && !hasToggled) {
            // Toggle expanded state
            if (toolbar.classList.contains('is-expanded')) {
              toolbar.classList.remove('is-expanded');
            } else {
              toolbar.classList.add('is-expanded');
              this.plugin.hapticFeedback(15);
            }
            // Mark that we've toggled to prevent multiple toggles in same gesture
            hasToggled = true;
          }
        };

        toolbar.addEventListener('touchmove', handleTouchMove, {
          passive: true,
        });

        this.plugin.elementsToCleanup.set(toolbar, () => {
          toolbar.removeEventListener('touchstart', handleTouchStart);
          toolbar.removeEventListener('touchmove', handleTouchMove);
        });
      }

      update(update: ViewUpdate) {
        if (
          update.selectionSet ||
          update.viewportChanged ||
          update.docChanged
        ) {
          this.view = update.view;
          // Defer tooltip update to avoid reading layout during update
          window.requestAnimationFrame(() => this.updateTooltip(update.view));
        }
      }

      updateTooltip(view: EditorView) {
        const selection = view.state.selection.main;

        // Show toolbar if there's a selection or cursor is in specific context
        if (!selection.empty || this.hasContext(view, selection.from)) {
          this.renderToolbar(view);
          return;
        }

        this.currentToolbar = null;
        this.emptyElement();
      }

      hasContext(view: EditorView, pos: number): boolean {
        const activeContexts = this.getMatchingContexts(view, pos);
        // Check if any binding matches the current context
        return this.plugin.settings.contextBindings.some(binding =>
          activeContexts.has(binding.contextType),
        );
      }

      getActiveToolbar(view: EditorView, pos: number): ToolbarConfig | null {
        const activeContexts = this.getMatchingContexts(view, pos);
        // Collect all matching toolbars and concatenate their commands

        const seenCommands = new Set<string>();
        const matchingBindings = this.plugin.settings.contextBindings.filter(
          binding => activeContexts.has(binding.contextType),
        );

        // Concatenate commands from all matching toolbars, removing duplicates
        const combinedCommands: string[] = matchingBindings
          .flatMap(binding => {
            const toolbar = this.plugin.settings.toolbars.find(
              t => t.id === binding.toolbarId,
            );

            return toolbar?.commands ?? [];
          })
          .filter(cmd => {
            if (seenCommands.has(cmd)) {
              return false;
            } else {
              seenCommands.add(cmd);
              return true;
            }
          });

        this.activeToolbars =
          matchingBindings
            .map(binding =>
              this.plugin.settings.toolbars.find(
                t => t.id === binding.toolbarId,
              ),
            )
            .filter(t => t !== undefined)
            .flat() || null;

        // Return a virtual toolbar with combined commands
        return {
          id: 'combined',
          name: 'Combined toolbar',
          commands: combinedCommands,
        };
      }

      /**
       * Check if a command is available in the current context
       */
      isCommandAvailable(commandId: string, view: EditorView): boolean {
        const command = this.app.commands?.findCommand?.(commandId);

        if (!command) {
          return false;
        }

        // If the command has a checkCallback, run it to determine availability
        if (command.checkCallback) {
          try {
            return command.checkCallback(true) || false;
          } catch (e) {
            // If checkCallback throws, assume unavailable
            console.warn(`Command ${commandId} checkCallback error:`, e);
            return false;
          }
        }

        // If the command has an editorCheckCallback, we need to check with editor context
        if (command.editorCheckCallback) {
          try {
            // Get the active MarkdownView to access the editor
            const activeView =
              this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView && activeView.editor) {
              return (
                command.editorCheckCallback(
                  true,
                  activeView.editor,
                  activeView,
                ) || false
              );
            }
            return false;
          } catch (e) {
            console.warn(`Command ${commandId} editorCheckCallback error:`, e);
            return false;
          }
        }

        // If no callback exists, assume the command is available
        return true;
      }

      getMatchingContexts(view: EditorView, pos: number): Set<ContextType> {
        const contexts = new Set<ContextType>();
        if (!view.state.selection.main.empty) {
          contexts.add('selection');
        }
        if (
          !window.activeDocument.body.classList.contains('mod-toolbar-open')
        ) {
          contexts.add('keyboard-closed');
        }
        contexts.add('default');

        syntaxTree(view.state).iterate({
          from: pos,
          to: pos,
          // Using SyntaxNodeRef type from CodeMirror but accepting broad type for compatibility
          enter: (node: { type: { name: string } }) => {
            const nodeName = node.type.name;

            if (
              nodeName === 'BulletList' ||
              nodeName === 'OrderedList' ||
              nodeName.startsWith('HyperMD-list-line_HyperMD-list-line-')
            ) {
              contexts.add('list');
            }

            if (nodeName === 'Task' || nodeName.includes('HyperMD-task-line')) {
              contexts.add('task');
            }

            if (
              nodeName.startsWith('ATXHeading') ||
              nodeName === 'SetextHeading' ||
              nodeName.startsWith('HyperMD-header')
            ) {
              contexts.add('heading');
            }

            if (
              nodeName === 'FencedCode' ||
              nodeName === 'CodeBlock' ||
              nodeName.includes('HyperMD-codeblock')
            ) {
              contexts.add('code-block');
            }

            if (
              nodeName === 'Table' ||
              nodeName.startsWith('Table') ||
              nodeName.includes('HyperMD-table')
            ) {
              contexts.add('table');
            }

            if (
              nodeName === 'Blockquote' ||
              nodeName === 'QuoteMark' ||
              nodeName.includes('HyperMD-quote')
            ) {
              contexts.add('blockquote');
            }

            if (
              nodeName === 'Link' ||
              nodeName.includes('link') ||
              nodeName.includes('URL') ||
              nodeName.includes('HyperMD-link')
            ) {
              contexts.add('link');
            }
          },
        });

        return contexts;
      }

      renderToolbar(view: EditorView) {
        // Helper to remove existing tooltip

        if (!this.plugin.settings.showToolbars) {
          this.emptyElement();
          return;
        }

        const selection = view.state.selection.main;

        // Get the active toolbar based on context
        const activeToolbar = this.getActiveToolbar(view, selection.from);

        if (!activeToolbar || activeToolbar.commands.length === 0) {
          this.emptyElement();
          return;
        }

        // see if toolbar is unchanged
        if (
          this.currentToolbar &&
          this.currentToolbar.id === activeToolbar.id &&
          this.currentToolbar.commands.length ===
            activeToolbar.commands.length &&
          this.currentToolbar.commands.every(
            (cmd, idx) => cmd === activeToolbar.commands[idx],
          )
        ) {
          // Toolbar is unchanged, no need to re-render
          return;
        }

        this.currentToolbar = activeToolbar;

        // Find the workspace-leaf-content container to anchor the toolbar
        // This ensures the toolbar appears at the bottom of the editor container,
        // not inside table cells or other nested elements
        const tooltip = this.Element;
        if (!tooltip) return;
        tooltip.empty();
        // Add swipe-to-expand functionality
        this.addSwipeToExpandListener(tooltip);

        // Get all available commands
        const commands = this.app.commands?.commands || {};

        // Add command buttons (only show available commands)
        activeToolbar.commands.forEach(commandId => {
          const command = commands[commandId];
          const iconToUse =
            this.plugin.settings.commandIcons[commandId] ||
            command?.icon ||
            'circle-question-mark';

          // Check if command is available in current context
          if (command && tooltip) {
            if (this.plugin.settings.useIcons && iconToUse) {
              new ExtraButtonComponent(tooltip)
                .setIcon(iconToUse)
                .setTooltip(command?.name || commandId)
                .onClick(() => {
                  // Haptic feedback on button click
                  this.plugin.hapticFeedback(10);
                  // Execute the command
                  this.app.commands?.executeCommandById?.(commandId);
                  // Refocus editor to prevent focus loss
                  // log the current focus and whether that's inside the toolbar
                  if (tooltip.contains(activeDocument.activeElement))
                    view.focus();
                });
            } else {
              new ButtonComponent(tooltip)
                .setButtonText(command?.name || commandId)
                .setTooltip(command?.name || commandId)
                .onClick(e => {
                  e.preventDefault();
                  // Haptic feedback on button click
                  this.plugin.hapticFeedback(10);
                  // Execute the command
                  this.app.commands?.executeCommandById?.(commandId);
                  // Refocus editor to prevent focus loss
                  if (tooltip.contains(activeDocument.activeElement))
                    view.focus();
                });
            }
          }
        });
        if (tooltip)
          new ExtraButtonComponent(tooltip)
            .setIcon('pencil')
            .setTooltip('Edit toolbar')
            .onClick(() => {
              if (this.activeToolbars)
                new ToolbarEditor(
                  this.app,
                  this.plugin,
                  this.activeToolbars[0],
                ).open();
            });
      }

      private removeTooltipIfExists() {
        const activeView = this.activeView;
        if (!activeView) return;
        this.plugin.toolbarMap.get(activeView)?.remove();
        this.plugin.toolbarMap.delete(activeView);
      }

      emptyElement() {
        const activeView = this.activeView;
        if (!activeView) return;
        this.plugin.toolbarMap.get(activeView)?.empty();
      }

      get Element(): HTMLElement | null {
        const activeView = this.activeView;
        if (!activeView) return null;

        return (
          this.plugin.toolbarMap.get(activeView) ||
          this.createToolbarElement(activeView)
        );
      }

      createToolbarElement(activeView: View): HTMLElement | null {
        const element = activeView.containerEl.createDiv({
          cls: 'mobile-plugin-toolbar',
        });

        this.plugin.toolbarMap.set(activeView, element);

        this.plugin.register(() => element.remove());

        return element;
      }

      destroy() {
        window.visualViewport?.removeEventListener(
          'resize',
          this.refreshToolbar,
        );
        window.removeEventListener('resize', this.refreshToolbar);
        window.activeDocument.removeEventListener(
          'focusin',
          this.refreshToolbar,
        );
        window.activeDocument.removeEventListener(
          'focusout',
          this.refreshToolbar,
        );
        this.removeTooltipIfExists();
      }
    },
    {
      // No decorations needed for this plugin
    },
  );
}
