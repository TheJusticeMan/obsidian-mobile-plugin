const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTypeScriptModule(relativePath, runtimeModules = {}) {
  const filePath = path.join(__dirname, '..', relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  const moduleRequire = id =>
    Object.hasOwn(runtimeModules, id) ? runtimeModules[id] : require(id);
  new Function('exports', 'require', 'module', outputText)(
    module.exports,
    moduleRequire,
    module,
  );
  return module.exports;
}

const {
  executeToolbarCommand,
} = loadTypeScriptModule('src/utils/toolbar-command.ts');
const {
  MOBILE_TOOLBAR_CLASSES,
  preventToolbarFocusLoss,
} = loadTypeScriptModule('src/utils/toolbar-dom.ts');

class TestComponent {
  registerEvent(eventRef) {
    this.registeredEvent = eventRef;
  }

  register(cleanup) {
    this.registeredCleanup = cleanup;
  }
}

const { SwipeActions } = loadTypeScriptModule('src/features/swipe-actions.ts', {
  obsidian: { Component: TestComponent },
});

test('SwipeActions listens to swipe without wrapping workspace.trigger', () => {
  let swipeListener;
  const triggerCalls = [];
  const executedCommands = [];
  const originalTrigger = (...args) => triggerCalls.push(args);
  const workspace = {
    trigger: originalTrigger,
    on(eventName, callback) {
      assert.equal(eventName, 'swipe');
      swipeListener = callback;
      return { eventName };
    },
    rootSplit: { containerEl: { contains: target => target === 'editor' } },
  };
  const app = {
    workspace,
    commands: { executeCommandById: id => executedCommands.push(id) },
  };
  const plugin = {
    settings: {
      swipeActions: {
        twoFingerSwipeDown: 'test:swipe-down',
        noteBottomSwipeUp: 'test:swipe-up',
      },
    },
  };

  const swipeActions = new SwipeActions(app, plugin);
  swipeActions.onload();

  assert.strictEqual(workspace.trigger, originalTrigger);
  assert.equal(typeof swipeListener, 'function');
  const event = {};
  const editor = {};
  const info = {};
  workspace.trigger('editor-paste', event, editor, info);
  assert.deepEqual(triggerCalls, [['editor-paste', event, editor, info]]);

  swipeListener({
    direction: 'y',
    points: 1,
    startY: 20,
    y: 10,
    targetEl: 'editor',
  });
  assert.deepEqual(executedCommands, ['test:swipe-up']);
  assert.equal(swipeActions.registeredEvent.eventName, 'swipe');
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
  assert.doesNotMatch(toolbarSource, /tooltip\.contains\(activeDocument\.activeElement\)/);
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
