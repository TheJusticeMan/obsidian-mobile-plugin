import {
  App,
  ButtonComponent,
  Command,
  MarkdownView,
  Modal,
  Setting,
} from 'obsidian';
import { GestureHandler, Offset } from './gesture-handler';
import MobilePlugin from './main';
import { CommandSuggestModal } from './settings';

/**
 * Manages FAB placement and lifecycle across editor leaves.
 */
export class FABManager {
  private fabElements: Map<MarkdownView, ButtonComponent> = new Map();
  private currentMode: 'default' | 'recording' = 'default';

  /*   setIcon(name: string): void {
    this.fabElements.forEach((fab) => {
      fab.setIcon(name);
    });
  }
 */
  setMode(mode: 'default' | 'recording'): void {
    this.currentMode = mode;
    this.fabElements.forEach((fab) => {
      if (fab instanceof MobileFAB) {
        fab.setMode(mode);
      }
    });
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
      this.app.workspace.on('active-leaf-change', () =>
        this.updateActiveLeaf(),
      ),
    );

    // Initial FAB setup
    this.app.workspace.onLayoutReady(() => this.updateActiveLeaf());
  }

  /**
   * Updates FAB for the active leaf
   */
  updateActiveLeaf(): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      this.ensureFABForLeaf(activeView);
    }
  }

  /**
   * Ensures a FAB exists for the given leaf
   */
  private ensureFABForLeaf(view: MarkdownView): void {
    if (!this.plugin.settings.showFAB) {
      return;
    }
    // Don't create duplicate FABs
    if (!this.fabElements.has(view)) {
      // Create and mount FAB
      this.fabElements.set(
        view,
        new MobileFAB(this.app, this.plugin, view.containerEl),
      );
    }
  }

  /**
   * Refreshes FABs based on settings
   */
  refresh(): void {
    if (!this.plugin.settings.showFAB) {
      this.destroy();
    } else {
      this.updateActiveLeaf();
    }
  }

  /**
   * Cleans up all FABs
   */
  destroy(): void {
    this.fabElements.forEach((fab) => {
      if (fab instanceof MobileFAB) {
        fab.teardown();
      }
      fab.buttonEl.remove();
    });
    this.fabElements.clear();
  }
}

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
        this.hapticFeedback(10);
        plugin.triggerCMDEvent('fab-press');
      })
      .then((btn) =>
        btn.buttonEl.addEventListener('contextmenu', (e) => {
          if (this.mode === 'recording') {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          this.hapticFeedback(20);
          plugin.triggerCMDEvent('fab-longpress');
        }),
      )
      .then((btn) => {
        // Add recording mode listeners
        const startRecording = (e: Event) => {
          if (this.mode !== 'recording') return;
          e.preventDefault();
          e.stopPropagation();
          this.hapticFeedback(10);
          plugin.triggerCMDEvent('fab-record-start');
          btn.buttonEl.addClass('is-recording');
        };

        const stopRecording = (e: Event) => {
          if (this.mode !== 'recording') return;
          e.preventDefault();
          e.stopPropagation();
          this.hapticFeedback(10);
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
        btn.buttonEl.addEventListener('mouseleave', (e) => {
          if (
            this.mode === 'recording' &&
            btn.buttonEl.hasClass('is-recording')
          ) {
            stopRecording(e);
          }
        });

        this.gestureHandler = new GestureHandler(
          this.app,
          btn.buttonEl,
          plugin.settings.gestureCommands,
          (line) => {
            if (this.mode === 'recording') return;
            new NewGesture(this.app, this.plugin, line).then((g) =>
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
  }

  private hapticFeedback(duration = 10): void {
    if (this.plugin.settings.enableHapticFeedback && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }
}

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
      .addButton((btn) =>
        btn.setButtonText('Select command').onClick(() => {
          this.openCommandSelection();
          this.close();
        }),
      )
      .addButton((btn) =>
        btn.setButtonText('Cancel').onClick(() => this.close()),
      )
      .addButton((btn) =>
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
          this.line.map((p) => [
            Number(p.x.toFixed(2)),
            Number(p.y.toFixed(2)),
          ]),
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
