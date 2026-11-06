import type { Command, MarkdownFileInfo } from 'obsidian';

/**
 * Execute editor-aware commands against the editor that owns the toolbar.
 *
 * Obsidian's global command dispatcher resolves editor commands through the
 * workspace's active editor. Embedded CodeMirror editors can differ from that
 * editor, so use the command callback with the editor context attached to the
 * CodeMirror state when available.
 */
export function executeToolbarCommand(
  command: Command | undefined,
  context: MarkdownFileInfo | undefined,
  executeCommandById: () => void,
): void {
  const editor = context?.editor;

  if (editor && command?.editorCheckCallback) {
    command.editorCheckCallback(false, editor, context);
    return;
  }

  if (editor && command?.editorCallback) {
    command.editorCallback(editor, context);
    return;
  }

  executeCommandById();
}
