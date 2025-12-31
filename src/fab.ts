import { App, ButtonComponent, Command, Modal, Setting, View } from 'obsidian';
import { GestureHandler, Offset } from './gesture-handler';
import MobilePlugin from './main';
import { CommandSuggestModal } from './settings';

/**
 * Manages FAB (Floating Action Button) placement and lifecycle across editor leaves.
 *
 * Responsible for creating, updating, and destroying FAB instances for each
 * workspace view. Handles mode switching between default and recording modes.
 * Automatically creates FABs when new leaves are opened and cleans them up
 * when the plugin is disabled or unloaded.
 */
export class FABManager {
  private fabElements: Map<View, MobileFAB> = new Map();
  private currentMode: 'default' | 'recording' = 'default';

  setMode(mode: 'default' | 'recording'): void {
    this.currentMode = mode;
    this.fabElements.forEach(fab => fab.setMode(mode));
  }

  getMode(): 'default' | 'recording' {
    return this.currentMode;
  }

  constructor(
    private app: App,
    private plugin: MobilePlugin,
  ) {
    // Update FAB when workspace layout changes
    this.plugin.registerEvent(
      this.app.workspace.on('active-leaf-change', this.ensureAllFABs),
    );
    this.plugin.registerEvent(
      this.app.workspace.on('layout-change', this.ensureAllFABs),
    );

    // Initial FAB setup
    this.app.workspace.onLayoutReady(this.ensureAllFABs);
  }

  private ensureAllFABs = (): void => {
    if (!this.plugin.settings.showFAB) return;

    /* Don't create duplicate FABs*/
    this.app.workspace.iterateRootLeaves(
      leaf =>
        !this.fabElements.has(leaf.view) &&
        this.fabElements.set(
          leaf.view,
          new MobileFAB(this.app, this.plugin, leaf.view.containerEl),
        ),
    );
  };

  /**
   * Refreshes FABs based on settings
   */
  refresh(): void {
    if (!this.plugin.settings.showFAB) this.destroy();
    else this.ensureAllFABs();
  }

  /**
   * Cleans up all FABs
   */
  destroy(): void {
    this.fabElements.forEach(fab => fab.teardown());
    this.fabElements.clear();
  }
}

/**
 * Mobile FAB (Floating Action Button) component.
 *
 * A persistent button that floats at the bottom-right of the editor view,
 * providing quick access to common actions. Features include:
 * - Press: Execute configured command
 * - Long press: Execute alternative command (e.g., command palette)
 * - Gesture drawing: Draw gestures from the FAB to trigger custom commands
 * - Recording mode: Hold to record audio (when audio recorder plugin is available)
 * - Haptic feedback: Vibration feedback on touch devices
 *
 * @extends ButtonComponent
 */
class MobileFAB extends ButtonComponent {
  private gestureHandler: GestureHandler;
  private mode: 'default' | 'recording' = 'default';

  constructor(
    private app: App,
    public plugin: MobilePlugin,
    containerEl: HTMLElement,
  ) {
    super(containerEl);

    this.setTooltip('Create new note (long press for command palette)')
      .setIcon('plus')
      .setClass('mobile-fab')
      .onClick(() => {
        if (this.mode === 'recording') return;
        this.plugin.hapticFeedback(10);
        plugin.triggerCMDEvent('fab-press');
      })
      .then(btn =>
        btn.buttonEl.addEventListener('contextmenu', e => {
          if (this.mode === 'recording') {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          this.plugin.hapticFeedback(20);
          plugin.triggerCMDEvent('fab-longpress');
        }),
      )
      .then(btn => {
        // Add recording mode listeners
        const startRecording = (e: Event) => {
          if (this.mode !== 'recording') return;
          e.preventDefault();
          e.stopPropagation();
          this.plugin.hapticFeedback(10);
          plugin.triggerCMDEvent('fab-record-start');
          btn.buttonEl.addClass('is-recording');
        };

        const stopRecording = (e: Event) => {
          if (
            this.mode !== 'recording' ||
            !btn.buttonEl.hasClass('is-recording')
          )
            return;
          e.preventDefault();
          e.stopPropagation();
          this.plugin.hapticFeedback(10);
          plugin.triggerCMDEvent('fab-record-stop');
          btn.buttonEl.removeClass('is-recording');
        };

        btn.buttonEl.addEventListener('touchstart', startRecording, {
          passive: false,
        });
        btn.buttonEl.addEventListener('touchend', stopRecording, {
          passive: false,
        });
        btn.buttonEl.addEventListener('mousedown', startRecording);
        btn.buttonEl.addEventListener('mouseup', stopRecording);
        btn.buttonEl.addEventListener('mouseleave', stopRecording);

        this.gestureHandler = new GestureHandler(
          this.app,
          btn.buttonEl,
          plugin.settings.gestureCommands,
          line => {
            if (this.mode === 'recording') return;
            new NewGesture(this.app, this.plugin, line).then(g =>
              this.plugin.settings.showCommandConfirmation
                ? g.open()
                : g.openCommandSelection(),
            );
          },
        );
      });
    this.setMode(this.plugin.fabManager?.getMode() || 'default');
  }

  setMode(mode: 'default' | 'recording') {
    this.mode = mode;
    if (mode === 'recording') {
      this.setIcon('microphone');
      this.buttonEl.addClass('recording-mode');
    } else {
      this.setIcon('plus');
      this.buttonEl.removeClass('recording-mode');
    }
  }

  teardown() {
    this.gestureHandler?.destroy();
    this.buttonEl.remove();
  }
}

/**
 * Modal dialog for assigning commands to newly drawn gestures.
 *
 * Appears when a user draws an unrecognized gesture from the FAB,
 * allowing them to:
 * - Assign a command to the gesture
 * - Skip the confirmation dialog in future
 * - Cancel and discard the gesture
 *
 * @extends Modal
 */
class NewGesture extends Modal {
  constructor(
    app: App,
    private plugin: MobilePlugin,
    private line: Offset[],
  ) {
    super(app);
  }

  onOpen(): void {
    new Setting(this.contentEl)
      .setName('Assign action to new gesture')
      .setDesc('Select a command to assign to the new gesture.')
      .addButton(btn =>
        btn.setButtonText('Select command').onClick(() => {
          this.openCommandSelection();
          this.close();
        }),
      )
      .addButton(btn => btn.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(btn =>
        btn
          .setButtonText('Skip to command selection')
          .setCta()
          .onClick(() => {
            this.plugin.settings.showCommandConfirmation = false;
            void this.plugin.saveSettings();
            this.openCommandSelection();
            this.close();
          }),
      );
  }

  openCommandSelection(): void {
    new CommandSuggestModal(this.app, (command: Command) => {
      // Assign selected command to the new gesture
      this.plugin.settings.gestureCommands.push({
        name: command.name || 'unnamed',
        commandId: command.id,
        gesturePath: JSON.stringify(
          this.line.map(p => [Number(p.x.toFixed(2)), Number(p.y.toFixed(2))]),
        ),
      });

      void this.plugin.saveSettings();
      this.close();
    }).open();
  }

  then(cb: (modal: this) => void): this {
    cb(this);
    return this;
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
