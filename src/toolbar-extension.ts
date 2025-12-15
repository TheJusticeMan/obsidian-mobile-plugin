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
  MarkdownView,
} from 'obsidian';
import MobilePlugin, { CommandManager } from './main';
import { ContextType, ToolbarConfig, ToolbarEditor } from './settings';

/**
 * Creates a CodeMirror 6 ViewPlugin that displays a context-aware toolbar at the bottom
 * when text is selected or cursor is in a specific context.
 */
export function createToolbarExtension(app: App, plugin: MobilePlugin) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      tooltip: HTMLElement | null = null;
      app: App;
      plugin: MobilePlugin;
      mainToolbar: ToolbarConfig | null = null;

      constructor(view: EditorView) {
        this.decorations = Decoration.none;
        this.app = app;
        this.plugin = plugin;

        // Find the editor container to anchor the toolbar

        this.updateTooltip(view);
      }
      get commandManager(): CommandManager | undefined {
        return (this.app as { commands?: CommandManager }).commands;
      }

      hapticFeedback(duration = 10): void {
        if (this.plugin.settings.enableHapticFeedback && navigator.vibrate) {
          navigator.vibrate(duration);
        }
      }

      /**
       * Add swipe gesture to expand toolbar
       */
      addSwipeToExpandListener(toolbar: HTMLElement): void {
        const SWIPE_THRESHOLD_PX = 30;

        let touchStartY = 0;
        let hasToggled = false;

        toolbar.addEventListener('touchstart', (e) => {
          touchStartY = e.touches[0].clientY;
          hasToggled = false;
        });

        toolbar.addEventListener('touchmove', (e) => {
          const touchY = e.touches[0].clientY;
          const deltaY = touchStartY - touchY;

          // If swiped up more than threshold and haven't toggled yet
          if (deltaY > SWIPE_THRESHOLD_PX && !hasToggled) {
            // Prevent default scrolling behavior when expanding toolbar
            e.preventDefault();

            // Toggle expanded state
            if (toolbar.classList.contains('is-expanded')) {
              toolbar.classList.remove('is-expanded');
            } else {
              toolbar.classList.add('is-expanded');
              this.hapticFeedback(15);
            }
            // Mark that we've toggled to prevent multiple toggles in same gesture
            hasToggled = true;
          }
        });
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
          this.renderToolbar(view);
        }
      }

      hasContext(view: EditorView, pos: number): boolean {
        const activeContexts = this.getMatchingContexts(view, pos);
        // Check if any binding matches the current context
        for (const binding of this.plugin.settings.contextBindings) {
          if (activeContexts.has(binding.contextType)) {
            return true;
          }
        }
        return false;
      }

      getActiveToolbar(view: EditorView, pos: number): ToolbarConfig | null {
        const activeContexts = this.getMatchingContexts(view, pos);
        // Collect all matching toolbars and concatenate their commands
        const matchingToolbars: ToolbarConfig[] = [];
        const seenCommands = new Set<string>();

        for (const contextType of activeContexts) {
          for (const binding of this.plugin.settings.contextBindings) {
            if (binding.contextType === contextType) {
              const toolbar = this.plugin.settings.toolbars.find(
                (t) => t.id === binding.toolbarId,
              );
              if (toolbar) {
                matchingToolbars.push(toolbar);
              }
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

        this.mainToolbar = matchingToolbars[0] || null;

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
        const command = this.commandManager?.findCommand?.(commandId);

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
        if (!this.plugin.settings.showToolbars) {
          return;
        }

        const selection = view.state.selection.main;

        // Get the active toolbar based on context
        const activeToolbar = this.getActiveToolbar(view, selection.from);

        if (!activeToolbar || activeToolbar.commands.length === 0) {
          return;
        }

        // Find the workspace-leaf-content container to anchor the toolbar
        // This ensures the toolbar appears at the bottom of the editor container,
        // not inside table cells or other nested elements
        this.tooltip = (
          view.dom.closest('.workspace-leaf-content') || view.dom
        ).createDiv({ cls: 'mobile-plugin-toolbar' });
        // Add swipe-to-expand functionality
        if (this.tooltip) this.addSwipeToExpandListener(this.tooltip);

        // Get all available commands
        const commands = this.commandManager?.commands || {};

        // Add command buttons (only show available commands)
        activeToolbar.commands.forEach((commandId) => {
          const command = commands[commandId];
          const iconToUse =
            this.plugin.settings.commandIcons[commandId] ||
            command?.icon ||
            'question-mark-glyph';

          // Check if command is available in current context
          if (
            command &&
            this.tooltip &&
            this.isCommandAvailable(commandId, view)
          ) {
            if (this.plugin.settings.useIcons && iconToUse) {
              new ExtraButtonComponent(this.tooltip)
                .setIcon(iconToUse)
                .setTooltip(command?.name || commandId)
                .onClick(() => {
                  // Haptic feedback on button click
                  this.hapticFeedback(10);
                  // Execute the command
                  this.commandManager?.executeCommandById?.(commandId);
                  // Refocus editor to prevent focus loss
                  view.focus();
                });
            } else {
              new ButtonComponent(this.tooltip)
                .setButtonText(command?.name || commandId)
                .setTooltip(command?.name || commandId)
                .onClick((e) => {
                  e.preventDefault();
                  // Haptic feedback on button click
                  this.hapticFeedback(10);
                  // Execute the command
                  this.commandManager?.executeCommandById?.(commandId);
                  // Refocus editor to prevent focus loss
                  view.focus();
                });
            }
          }
        });
        if (this.tooltip)
          new ExtraButtonComponent(this.tooltip)
            .setIcon('pencil')
            .setTooltip('Edit toolbar')
            .onClick(() => {
              if (this.mainToolbar)
                new ToolbarEditor(
                  this.app,
                  this.plugin,
                  this.mainToolbar,
                ).open();
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
    },
  );
}
