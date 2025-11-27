import {
  App,
  ButtonComponent,
  Command,
  MarkdownView,
  Modal,
  Setting,
} from 'obsidian';
import MobilePlugin from './main';
import { CommandSuggestModal } from './settings';

/**
 * Helper function to set CSS properties on an element
 * Uses Object.assign for better performance when setting multiple properties
 */
function setCssProps(el: HTMLElement, props: Record<string, string>): void {
  Object.assign(el.style, props);
}

/**
 * Manages FAB placement and lifecycle across editor leaves.
 */
export class FABManager {
  private fabElements: Map<MarkdownView, ButtonComponent> = new Map();

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
    // Don't create duplicate FABs
    if (!this.fabElements.has(view)) {
      // Create and mount FAB
      this.fabElements.set(view, this.createFAB(view.containerEl));
    }
  }

  /**
   * Creates a FAB element
   */
  private createFAB(containerEl: HTMLElement): ButtonComponent {
    return new MobileFAB(this.app, this.plugin, containerEl);
  }

  /**
   * Cleans up all FABs
   */
  destroy(): void {
    this.fabElements.forEach((fab) => fab.buttonEl.remove());
    this.fabElements.clear();
  }
}

class MobileFAB extends ButtonComponent {
  private start: Offset = new Offset(0, 0);
  private last: Offset = new Offset(0, 0);
  private line: Offset[] = [];

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
        this.hapticFeedback(10);
        plugin.pluspress();
      })
      .then((btn) =>
        btn.buttonEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.hapticFeedback(20);
          plugin.plusLongpress();
        }),
      )
      .then((btn) => {
        btn.buttonEl.addEventListener('touchstart', this.startDrag);
        btn.buttonEl.addEventListener('mousedown', this.startDrag);
      });
  }

  private hapticFeedback(duration = 10): void {
    if (this.plugin.settings.enableHapticFeedback && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }

  startDrag = (e: MouseEvent | TouchEvent): void => {
    if (e instanceof MouseEvent) {
      this.start = new Offset(e.clientX, e.clientY);
      document.addEventListener('mousemove', this.onDrag);
      document.addEventListener('mouseup', this.endDrag);
    } else if (e.touches && e.touches.length > 0) {
      this.start = new Offset(e.touches[0].clientX, e.touches[0].clientY);
      document.addEventListener('touchmove', this.onDrag);
      document.addEventListener('touchend', this.endDrag);
    }
    this.last = this.start;
    this.line = [this.start];
  };

  onDrag = (e: MouseEvent | TouchEvent): void => {
    let client: Offset;
    if (e instanceof MouseEvent) {
      client = new Offset(e.clientX, e.clientY);
    } else if (e.touches && e.touches.length > 0) {
      client = new Offset(e.touches[0].clientX, e.touches[0].clientY);
    } else {
      return;
    }
    const d = client.subtract(this.start).applyDampening(0.5);
    this.drawTempline(this.last, client, 1000);
    this.last = client;
    this.line.push(client);
    setCssProps(this.buttonEl, { translate: `${d.x}px ${d.y}px` });
  };

  endDrag = (): void => {
    setCssProps(this.buttonEl, { translate: '0px 0px' });

    document.removeEventListener('mousemove', this.onDrag);
    document.removeEventListener('mouseup', this.endDrag);
    document.removeEventListener('touchmove', this.onDrag);
    document.removeEventListener('touchend', this.endDrag);

    this.detectGesture();
  };

  drawTempline(start: Offset, end: Offset, lifeTime = 1000): void {
    const line = document.body.createDiv({ cls: 'mobile-fab-dragline' });
    const delta = end.subtract(start);
    const length = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
    const angle = Math.atan2(delta.y, delta.x) * (180 / Math.PI);
    setCssProps(line, {
      width: `${length}px`,
      height: '8px',
      transform: `rotate(${angle}deg)`,
      left: `${start.x}px`,
      top: `${start.y}px`,
      transition: `opacity ${lifeTime}ms, height ${lifeTime}ms`,
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        line.addClass('is-fading');
      });
    });
    setTimeout(() => line.remove(), lifeTime);
  }

  detectGesture(): void {
    if (this.line.length < 2) return;
    if (this.getLength(this.line) < 100) return;

    const normalizedInput = this.normalizeLine(this.line);

    let bestMatch = null;
    let minDiff = Infinity;

    for (const gesture of this.plugin.settings.gestureCommands) {
      const normalizedPreset = JSON.parse(gesture.gesturePath).map(
        (p: number[]) => new Offset(p[0], p[1]),
      );
      const diff = this.calculateDifference(normalizedInput, normalizedPreset);

      if (diff < minDiff) {
        minDiff = diff;
        bestMatch = gesture;
      }
    }

    if (bestMatch && minDiff < 0.5) {
      // Execute associated command
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Obsidian's commands API is not typed
      (this.app as any).commands?.executeCommandById(bestMatch.commandId);
      this.buttonEl.removeClass('gesture-animating');
      requestAnimationFrame(() => {
        this.buttonEl.addClass('gesture-success');
        requestAnimationFrame(() => {
          this.buttonEl.addClass('gesture-animating');
          this.buttonEl.removeClass('gesture-success');
        });
      });
    } else {
      new NewGesture(this.app, this.plugin, normalizedInput).then((g) =>
        this.plugin.settings.showCommandConfirmation
          ? g.open()
          : g.openCommandSelection(),
      );
      // Draw the gesture for user feedback
      this.start = this.line[0];
      for (let i = 0; i < normalizedInput.length - 1; i++) {
        this.drawTempline(
          normalizedInput[i].add(this.start),
          normalizedInput[i + 1].add(this.start),
          3000,
        );
      }
    }
  }

  normalizeLine(line: Offset[]): Offset[] {
    if (line.length === 0) return [];
    const start = line[0];
    const translated = line.map((p) => p.subtract(start));
    return this.resample(translated, 40);
  }

  getLength(line: Offset[]): number {
    let length = 0;
    for (let i = 0; i < line.length - 1; i++) {
      length += line[i].distanceTo(line[i + 1]);
    }
    return length;
  }

  resample(line: Offset[], n: number): Offset[] {
    if (line.length === 0) return [];
    if (line.length === 1) {
      return Array.from({ length: n }, () => new Offset(line[0].x, line[0].y));
    }

    const totalLength = this.getLength(line);

    if (totalLength === 0) {
      return Array.from({ length: n }, () => new Offset(line[0].x, line[0].y));
    }

    const interval = totalLength / (n - 1);
    const newLine: Offset[] = [line[0]];
    let currentDist = 0;
    let currentPointIndex = 0;

    for (let i = 1; i < n; i++) {
      const targetDist = i * interval;
      while (currentPointIndex < line.length - 1) {
        const p1 = line[currentPointIndex];
        const p2 = line[currentPointIndex + 1];
        const dist = p1.distanceTo(p2);

        if (currentDist + dist >= targetDist) {
          const t = (targetDist - currentDist) / dist;
          const x = p1.x + (p2.x - p1.x) * t;
          const y = p1.y + (p2.y - p1.y) * t;
          newLine.push(new Offset(x, y));
          break;
        }
        currentDist += dist;
        currentPointIndex++;
      }
    }
    while (newLine.length < n) {
      newLine.push(line[line.length - 1]);
    }
    return newLine;
  }

  calculateDifference(line1: Offset[], line2: Offset[]): number {
    let totalDiff = 0;
    const n = Math.min(line1.length, line2.length);
    if (n < 2) return Infinity;

    for (let i = 0; i < n - 1; i++) {
      const v1 = line1[i + 1].subtract(line1[i]);
      const v2 = line2[i + 1].subtract(line2[i]);

      const angle1 = Math.atan2(v1.y, v1.x);
      const angle2 = Math.atan2(v2.y, v2.x);

      let diff = Math.abs(angle1 - angle2);
      if (diff > Math.PI) {
        diff = 2 * Math.PI - diff;
      }

      totalDiff += diff;
    }
    return totalDiff / (n - 1);
  }
}

export class Offset {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  subtract(other: Offset): Offset {
    return new Offset(this.x - other.x, this.y - other.y);
  }
  add(other: Offset): Offset {
    return new Offset(this.x + other.x, this.y + other.y);
  }
  distanceTo(other: Offset): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  applyDampening(dampening: number): Offset {
    // Non-linear dampening: use a power function for smoother effect
    return new Offset(
      (Math.sign(this.x) * Math.pow(Math.abs(this.x), 0.7)) / dampening,
      (Math.sign(this.y) * Math.pow(Math.abs(this.y), 0.7)) / dampening,
    );
  }
}

export interface GestureCommand {
  name: string;
  commandId: string;
  gesturePath: string;
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
