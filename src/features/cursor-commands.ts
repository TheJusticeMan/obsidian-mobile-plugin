import MobilePlugin from '../main';

export function registerCursorCommands(plugin: MobilePlugin) {
  if (plugin.settings.enableCursorCommands) {
    // Navigation commands
    plugin.addCommand({
      id: 'cursor-up',
      name: 'Up',
      icon: 'arrow-up',
      editorCallback: editor => {
        const cursor = editor.getCursor();
        editor.setCursor({ line: Math.max(cursor.line - 1, 0), ch: cursor.ch });
      },
    });

    plugin.addCommand({
      id: 'cursor-down',
      name: 'Down',
      icon: 'arrow-down',
      editorCallback: editor => {
        const cursor = editor.getCursor();

        editor.setCursor({ line: cursor.line + 1, ch: cursor.ch });
      },
    });

    plugin.addCommand({
      id: 'cursor-left',
      name: 'Left',
      icon: 'arrow-left',
      editorCallback: editor => {
        const cursor = editor.getCursor();
        editor.setCursor({
          line: cursor.line - Number(cursor.ch === 0),
          ch: cursor.ch - 1,
        });
      },
    });

    plugin.addCommand({
      id: 'cursor-right',
      name: 'Right',
      icon: 'arrow-right',
      editorCallback: editor => {
        const cursor = editor.getCursor();
        editor.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
      },
    });
  }
  // Selection expansion commands (Plus)
  plugin.addCommand({
    id: 'select-plus-bottom',
    name: 'Expand down',
    icon: 'chevrons-down',
    editorCallback: editor => {
      const cursor = editor.getCursor('to');
      const currentLine = editor.getLine(cursor.line);

      // Find next word boundary or line end
      let nextPos = cursor.ch;
      const text = currentLine.slice(cursor.ch);

      // Skip current word characters
      const wordMatch = text.match(/^\w+/);
      if (wordMatch) {
        nextPos += wordMatch[0].length;
      } else {
        // Skip non-word characters to next word or end
        const nonWordMatch = text.match(/^\W+/);
        if (nonWordMatch) {
          nextPos += nonWordMatch[0].length;
        } else {
          nextPos = currentLine.length;
        }
      }

      // Set selection from current anchor to new position
      const from = editor.getCursor('from');
      editor.setSelection(from, { line: cursor.line, ch: nextPos });
    },
  });

  plugin.addCommand({
    id: 'select-plus-top',
    name: 'Expand up',
    icon: 'chevrons-up',
    editorCallback: editor => {
      const cursor = editor.getCursor('from');
      const currentLine = editor.getLine(cursor.line);

      // Find previous word boundary
      let prevPos = cursor.ch;
      const text = currentLine.slice(0, cursor.ch);

      // Skip backwards to find word boundary
      if (prevPos > 0) {
        // Reverse the string and find word boundary
        const reversed = text.split('').reverse().join('');
        const wordMatch = reversed.match(/^\w+/);
        if (wordMatch) {
          prevPos -= wordMatch[0].length;
        } else {
          const nonWordMatch = reversed.match(/^\W+/);
          if (nonWordMatch) {
            prevPos -= nonWordMatch[0].length;
          } else {
            prevPos = 0;
          }
        }
      }

      // Set selection from new position to current end
      const to = editor.getCursor('to');
      editor.setSelection({ line: cursor.line, ch: prevPos }, to);
    },
  });

  // Selection contraction commands (Minus)
  plugin.addCommand({
    id: 'select-minus-bottom',
    name: 'Shrink down',
    icon: 'chevron-down',
    editorCallback: editor => {
      const from = editor.getCursor('from');
      const to = editor.getCursor('to');

      if (from.line === to.line && from.ch === to.ch) {
        // No selection, do nothing
        return;
      }

      // Shrink from the end by one character
      let newTo = { line: to.line, ch: to.ch - 1 };

      // If at start of line, move to previous line end
      if (to.ch === 0 && to.line > from.line) {
        const prevLine = editor.getLine(to.line - 1);
        newTo = { line: to.line - 1, ch: prevLine.length };
      }

      // Ensure we don't go past the from position
      if (
        newTo.line < from.line ||
        (newTo.line === from.line && newTo.ch < from.ch)
      ) {
        newTo = from;
      }

      editor.setSelection(from, newTo);
    },
  });

  plugin.addCommand({
    id: 'select-minus-top',
    name: 'Shrink up',
    icon: 'chevron-up',
    editorCallback: editor => {
      const from = editor.getCursor('from');
      const to = editor.getCursor('to');

      if (from.line === to.line && from.ch === to.ch) {
        // No selection, do nothing
        return;
      }

      // Shrink from the start by one character
      let newFrom = { line: from.line, ch: from.ch + 1 };
      const currentLine = editor.getLine(from.line);

      // If at end of line, move to next line start
      if (from.ch >= currentLine.length && from.line < to.line) {
        newFrom = { line: from.line + 1, ch: 0 };
      }

      // Ensure we don't go past the to position
      if (
        newFrom.line > to.line ||
        (newFrom.line === to.line && newFrom.ch > to.ch)
      ) {
        newFrom = to;
      }

      editor.setSelection(newFrom, to);
    },
  });

  // Selection commands
  plugin.addCommand({
    id: 'select-word',
    name: 'Select word',
    icon: 'text-cursor',
    editorCallback: editor => {
      const cursor = editor.getCursor();
      const currentLine = editor.getLine(cursor.line);

      // If cursor is not on a word character, find the next word
      let cursorPos = cursor.ch;
      if (
        cursorPos < currentLine.length &&
        !/\w/.test(currentLine[cursorPos])
      ) {
        // Skip non-word characters to find next word
        while (
          cursorPos < currentLine.length &&
          !/\w/.test(currentLine[cursorPos])
        ) {
          cursorPos++;
        }
      }

      // Find word boundaries around cursor/next word
      let start = cursorPos;
      let end = cursorPos;

      // Move start backward to word boundary
      while (start > 0 && /\w/.test(currentLine[start - 1])) {
        start--;
      }

      // Move end forward to word boundary
      while (end < currentLine.length && /\w/.test(currentLine[end])) {
        end++;
      }

      // Select the word
      editor.setSelection(
        { line: cursor.line, ch: start },
        { line: cursor.line, ch: end },
      );
    },
  });

  plugin.addCommand({
    id: 'select-sentence',
    name: 'Select sentence',
    icon: 'type',
    editorCallback: editor => {
      const cursor = editor.getCursor();
      const text = editor.getValue();
      const offset = editor.posToOffset(cursor);

      // Find sentence boundaries (. ! ?) followed by space or newline
      let start = 0;
      let end = text.length;

      // Find start of sentence (after previous sentence ending or start of text)
      for (let i = offset - 1; i >= 0; i--) {
        if (
          (text[i] === '.' || text[i] === '!' || text[i] === '?') &&
          (text[i + 1] === ' ' || text[i + 1] === '\n' || i === offset - 1)
        ) {
          start = i + 1;
          // Skip whitespace after punctuation
          while (
            start < text.length &&
            (text[start] === ' ' || text[start] === '\n')
          ) {
            start++;
          }
          break;
        }
      }

      // Find end of sentence (next sentence ending)
      for (let i = offset; i < text.length; i++) {
        if (
          (text[i] === '.' || text[i] === '!' || text[i] === '?') &&
          (i === text.length - 1 || text[i + 1] === ' ' || text[i + 1] === '\n')
        ) {
          end = i + 1;
          break;
        }
      }

      // Convert offsets to positions
      const startPos = editor.offsetToPos(start);
      const endPos = editor.offsetToPos(end);

      editor.setSelection(startPos, endPos);
    },
  });

  plugin.addCommand({
    id: 'select-line',
    name: 'Select line',
    icon: 'minus',
    editorCallback: editor => {
      const cursor = editor.getCursor();
      const lastLine = editor.lastLine();

      // Select entire line including newline if not last line
      if (cursor.line < lastLine) {
        editor.setSelection(
          { line: cursor.line, ch: 0 },
          { line: cursor.line + 1, ch: 0 },
        );
      } else {
        // Last line - select to end of line
        const currentLine = editor.getLine(cursor.line);
        editor.setSelection(
          { line: cursor.line, ch: 0 },
          { line: cursor.line, ch: currentLine.length },
        );
      }
    },
  });

  plugin.addCommand({
    id: 'select-all',
    name: 'Select all',
    icon: 'file-text',
    editorCallback: editor => {
      const lastLine = editor.lastLine();
      const lastLineText = editor.getLine(lastLine);

      // Select from start to end of document
      editor.setSelection(
        { line: 0, ch: 0 },
        { line: lastLine, ch: lastLineText.length },
      );
    },
  });

  // Progressive selection command
  plugin.addCommand({
    id: 'select-more',
    name: 'Select more',
    icon: 'maximize-2',
    editorCallback: editor => {
      const from = editor.getCursor('from');
      const to = editor.getCursor('to');
      const hasSelection = !(from.line === to.line && from.ch === to.ch);

      if (!hasSelection) {
        // No selection - select word
        const cursor = editor.getCursor();
        const currentLine = editor.getLine(cursor.line);

        let cursorPos = cursor.ch;
        if (
          cursorPos < currentLine.length &&
          !/\w/.test(currentLine[cursorPos])
        ) {
          while (
            cursorPos < currentLine.length &&
            !/\w/.test(currentLine[cursorPos])
          ) {
            cursorPos++;
          }
        }

        let start = cursorPos;
        let end = cursorPos;

        while (start > 0 && /\w/.test(currentLine[start - 1])) {
          start--;
        }
        while (end < currentLine.length && /\w/.test(currentLine[end])) {
          end++;
        }

        editor.setSelection(
          { line: cursor.line, ch: start },
          { line: cursor.line, ch: end },
        );
        return;
      }

      // Check if current selection is a word
      const selectedText = editor.getSelection();
      const isWord =
        from.line === to.line &&
        selectedText.trim().length > 0 &&
        !selectedText.includes('\n') &&
        /^\w+$/.test(selectedText.trim());

      if (isWord) {
        // Word selected - select sentence
        const text = editor.getValue();
        const offset = editor.posToOffset(from);

        let start = 0;
        let end = text.length;

        for (let i = offset - 1; i >= 0; i--) {
          if (
            (text[i] === '.' || text[i] === '!' || text[i] === '?') &&
            (text[i + 1] === ' ' || text[i + 1] === '\n' || i === offset - 1)
          ) {
            start = i + 1;
            while (
              start < text.length &&
              (text[start] === ' ' || text[start] === '\n')
            ) {
              start++;
            }
            break;
          }
        }

        const toOffset = editor.posToOffset(to);
        for (let i = toOffset; i < text.length; i++) {
          if (
            (text[i] === '.' || text[i] === '!' || text[i] === '?') &&
            (i === text.length - 1 ||
              text[i + 1] === ' ' ||
              text[i + 1] === '\n')
          ) {
            end = i + 1;
            break;
          }
        }

        const startPos = editor.offsetToPos(start);
        const endPos = editor.offsetToPos(end);
        editor.setSelection(startPos, endPos);
        return;
      }

      // Check if current selection is a sentence or less than a line
      const currentLine = editor.getLine(from.line);
      const isFullLine =
        from.ch === 0 &&
        ((from.line < editor.lastLine() &&
          to.line === from.line + 1 &&
          to.ch === 0) ||
          (from.line === editor.lastLine() && to.ch === currentLine.length));

      if (!isFullLine) {
        // Not a full line - select whole line
        const lastLine = editor.lastLine();
        if (from.line < lastLine) {
          editor.setSelection(
            { line: from.line, ch: 0 },
            { line: from.line + 1, ch: 0 },
          );
        } else {
          editor.setSelection(
            { line: from.line, ch: 0 },
            { line: from.line, ch: currentLine.length },
          );
        }
        return;
      }

      // Line selected - select all
      const lastLine = editor.lastLine();
      const lastLineText = editor.getLine(lastLine);
      editor.setSelection(
        { line: 0, ch: 0 },
        { line: lastLine, ch: lastLineText.length },
      );
    },
  });
}
