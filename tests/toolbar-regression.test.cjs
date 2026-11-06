const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTypeScriptModule(relativePath) {
  const filePath = path.join(__dirname, '..', relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  new Function('exports', 'require', 'module', outputText)(
    module.exports,
    require,
    module,
  );
  return module.exports;
}

const { executeToolbarCommand } = loadTypeScriptModule(
  'src/utils/toolbar-command.ts',
);
const { MOBILE_TOOLBAR_CLASSES, preventToolbarFocusLoss } =
  loadTypeScriptModule('src/utils/toolbar-dom.ts');
const { openPluginSettings } = loadTypeScriptModule(
  'src/utils/settings-navigation.ts',
);

test('toolbar edit action opens the plugin settings tab', () => {
  const calls = [];
  const app = {
    setting: {
      open: () => calls.push('open'),
      openTabById: id => calls.push(id),
    },
  };

  openPluginSettings(app, 'mobile');
  assert.deepEqual(calls, ['open', 'mobile']);
});

test('toolbar edit action falls back to opening general settings', () => {
  let opened = false;
  const app = {
    commands: {
      executeCommandById: commandId => {
        assert.equal(commandId, 'app:open-settings');
        opened = true;
      },
    },
  };

  openPluginSettings(app, 'mobile');
  assert.equal(opened, true);
});

test('toolbar edit action does not construct a standalone toolbar editor', () => {
  const toolbarSource = fs.readFileSync(
    path.join(__dirname, '..', 'src/features/toolbar.ts'),
    'utf8',
  );
  assert.doesNotMatch(toolbarSource, /ToolbarEditor/);
});

test('toolbar carries click-outside ignore markers', () => {
  assert.match(MOBILE_TOOLBAR_CLASSES, /ignore-onclickoutside/);
  assert.match(MOBILE_TOOLBAR_CLASSES, /kanban-plugin__ignore-click-outside/);
});

test('toolbar prevents mousedown from stealing editor focus', () => {
  let listener;
  let capture;
  preventToolbarFocusLoss({
    addEventListener(type, callback, useCapture) {
      assert.equal(type, 'mousedown');
      listener = callback;
      capture = useCapture;
    },
  });

  let prevented = false;
  listener({ preventDefault: () => (prevented = true) });
  assert.equal(capture, true);
  assert.equal(prevented, true);
});

test('toolbar handlers never refocus the editor after a command', () => {
  const toolbarSource = fs.readFileSync(
    path.join(__dirname, '..', 'src/features/toolbar.ts'),
    'utf8',
  );
  assert.doesNotMatch(
    toolbarSource,
    /tooltip\.contains\(activeDocument\.activeElement\)/,
  );
  assert.doesNotMatch(toolbarSource, /view\.focus\(\)/);
});

test('editor check callback runs against the toolbar editor context', () => {
  const editor = {};
  const context = { editor };
  let dispatched = false;
  let globalDispatch = false;

  executeToolbarCommand(
    {
      editorCheckCallback(checking, actualEditor, actualContext) {
        assert.equal(checking, false);
        assert.equal(actualEditor, editor);
        assert.equal(actualContext, context);
        dispatched = true;
      },
    },
    context,
    () => (globalDispatch = true),
  );

  assert.equal(dispatched, true);
  assert.equal(globalDispatch, false);
});

test('editor callback runs against the toolbar editor context', () => {
  const editor = {};
  const context = { editor };
  let dispatched = false;

  executeToolbarCommand(
    {
      editorCallback(actualEditor, actualContext) {
        assert.equal(actualEditor, editor);
        assert.equal(actualContext, context);
        dispatched = true;
      },
    },
    context,
    () => assert.fail('global dispatch should not run'),
  );

  assert.equal(dispatched, true);
});

test('commands without an editor context use Obsidian global dispatch', () => {
  let globalDispatch = false;
  executeToolbarCommand(undefined, undefined, () => (globalDispatch = true));
  assert.equal(globalDispatch, true);
});
