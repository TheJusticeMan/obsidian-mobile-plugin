import {
  App,
  ButtonComponent,
  Command,
  MarkdownView,
  Modal,
  Setting,
} from "obsidian";
import MobilePlugin from "./main";
import { CommandSuggestModal } from "./settings";

/**
 * Manages FAB placement and lifecycle across editor leaves.
 */
export class FABManager {
  private fabElements: Map<MarkdownView, ButtonComponent> = new Map();

  constructor(private app: App, private plugin: MobilePlugin) {
    // Initial setup can be done here if needed
    // Update FAB when workspace layout changes
    this.plugin.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.updateActiveLeaf())
    );

    // Initial FAB setup
    this.app.workspace.onLayoutReady(() => this.updateActiveLeaf());
  }

  /**
   * Updates FAB for the active leaf
   */
  updateActiveLeaf() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      this.ensureFABForLeaf(activeView);
    }
  }

  /**
   * Ensures a FAB exists for the given leaf
   */
  private ensureFABForLeaf(view: MarkdownView) {
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
    // Change to new ButtonComponent style
    return new MobileFAB(this.app, this.plugin, containerEl);

    return new ButtonComponent(containerEl)
      .setTooltip("Create new note (long press for command palette)")
      .setIcon("plus")
      .setClass("mobile-fab")
      .onClick(async () => {
        this.hapticFeedback(10);
        await this.plugin.createNewNote();
      })
      .then((btn) =>
        btn.buttonEl.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          this.hapticFeedback(20);
          // Open command palette
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this.app as any).commands?.executeCommandById(
            "command-palette:open"
          );
        })
      );
  }

  /**
   * Triggers haptic feedback if enabled and supported
   */
  private hapticFeedback(duration: number = 10) {
    if (this.plugin.settings.enableHapticFeedback && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }

  /**
   * Cleans up all FABs
   */
  destroy() {
    this.fabElements.forEach((fab) => fab.buttonEl.remove());
    this.fabElements.clear();
  }
}

class MobileFAB extends ButtonComponent {
  constructor(
    private app: App,
    public plugin: MobilePlugin,
    containerEl: HTMLElement,
    private gesture: offset[] = []
  ) {
    super(containerEl);
    this.setTooltip("Create new note (long press for command palette)")
      .setIcon("plus")
      .setClass("mobile-fab")
      .onClick(async () => {
        this.hapticFeedback(10);
        await plugin.createNewNote();
      })
      .then((btn) =>
        btn.buttonEl.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          this.hapticFeedback(20);
          // Open command palette
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (app as any).commands?.executeCommandById("command-palette:open");
        })
      )
      .then((btn) => {
        btn.buttonEl.addEventListener("touchstart", this.startDrag);
        btn.buttonEl.addEventListener("mousedown", this.startDrag);
      });
  }
  private hapticFeedback(duration: number = 10) {
    if (this.plugin.settings.enableHapticFeedback && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }
  start: offset = new offset(0, 0);
  last: offset = new offset(0, 0);
  line: offset[] = [];
  startDrag = (e: MouseEvent | TouchEvent) => {
    if (e instanceof MouseEvent) {
      this.start = new offset(e.clientX, e.clientY);
      document.addEventListener("mousemove", this.onDrag);
      document.addEventListener("mouseup", this.endDrag);
    } else if (e.touches && e.touches.length > 0) {
      this.start = new offset(e.touches[0].clientX, e.touches[0].clientY);
      document.addEventListener("touchmove", this.onDrag);
      document.addEventListener("touchend", this.endDrag);
    }
    this.last = this.start;
    this.line = [this.start];
  };
  onDrag = (e: MouseEvent | TouchEvent) => {
    let client: offset;
    if (e instanceof MouseEvent) {
      client = new offset(e.clientX, e.clientY);
    } else if (e.touches && e.touches.length > 0) {
      client = new offset(e.touches[0].clientX, e.touches[0].clientY);
    } else {
      return;
    }
    const d = client.subtract(this.start).applyDampening(0.5);
    this.drawTempline(this.last, client, 100);
    this.last = client;
    this.line.push(client);
    this.buttonEl.style.translate = `${d.x}px ${d.y}px`;
  };
  endDrag = (e: MouseEvent | TouchEvent) => {
    this.buttonEl.style.translate = `0px 0px`;

    document.removeEventListener("mousemove", this.onDrag);
    document.removeEventListener("mouseup", this.endDrag);

    document.removeEventListener("touchmove", this.onDrag);
    document.removeEventListener("touchend", this.endDrag);

    this.detectGesture();
  };
  drawTempline(start: offset, end: offset, lifeTime: number = 1000) {
    const line = document.body.createDiv({ cls: "mobile-fab-dragline" });
    const delta = end.subtract(start);
    const length = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
    const angle = Math.atan2(delta.y, delta.x) * (180 / Math.PI);
    line.style.width = `${length}px`;
    line.style.transform = `rotate(${angle}deg)`;
    line.style.left = `${start.x}px`;
    line.style.top = `${start.y}px`;
    line.style.transition = `opacity ${lifeTime}ms`;
    setTimeout(() => {
      line.style.opacity = "0";
    }, 10);
    setTimeout(() => line.remove(), lifeTime);
  }
  newGestures: { name: string; line: offset[] }[] = [];
  detectGesture() {
    if (this.line.length < 2) return;

    const normalizedInput = this.normalizeLine(this.line);

    let bestMatch = null;
    let minDiff = Infinity;

    for (const gesture of this.plugin.settings.gestureCommands) {
      const normalizedPreset = gesture.line.map((p) => new offset(p[0], p[1]));
      const diff = this.calculateDifference(normalizedInput, normalizedPreset);

      if (diff < minDiff) {
        minDiff = diff;
        bestMatch = gesture;
      }
    }

    if (bestMatch && minDiff < 0.5) {
      this.onGestureDetected(bestMatch.name);
      // Execute associated command
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.app as any).commands?.executeCommandById(bestMatch.commandId);
    } else {
      new NewGesture(this.app, this.plugin, normalizedInput).open();
      // draw the gesture for user feedback
      this.start = this.line[0];
      for (let i = 0; i < normalizedInput.length - 1; i++) {
        this.drawTempline(
          normalizedInput[i].add(this.start),
          normalizedInput[i + 1].add(this.start),
          3000
        );
      }
    }
  }

  onGestureDetected(name: string) {
    // Placeholder for action
    if (name === "swipe-up") {
      // Action for swipe up
    }
  }

  normalizeLine(line: offset[]): offset[] {
    if (line.length === 0) return [];
    const start = line[0];
    const translated = line.map((p) => p.subtract(start));
    return this.resample(translated, 40);
  }

  resample(line: offset[], n: number): offset[] {
    if (line.length === 0) return [];
    if (line.length === 1) return Array(n).fill(line[0]);

    let totalLength = 0;
    for (let i = 0; i < line.length - 1; i++) {
      totalLength += line[i].distanceTo(line[i + 1]);
    }

    if (totalLength === 0) return Array(n).fill(line[0]);

    const interval = totalLength / (n - 1);
    const newLine: offset[] = [line[0]];
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
          newLine.push(new offset(x, y));
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

  calculateDifference(line1: offset[], line2: offset[]): number {
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

export class offset {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  subtract(other: offset): offset {
    return new offset(this.x - other.x, this.y - other.y);
  }
  add(other: offset): offset {
    return new offset(this.x + other.x, this.y + other.y);
  }
  distanceTo(other: offset): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  applyDampening(dampening: number): offset {
    // Non-linear dampening: use a power function for smoother effect
    return new offset(
      (Math.sign(this.x) * Math.pow(Math.abs(this.x), 0.7)) / dampening,
      (Math.sign(this.y) * Math.pow(Math.abs(this.y), 0.7)) / dampening
    );
  }
}

export interface GestureCommand {
  name: string;
  commandId: string;
  line: number[][];
}

class NewGesture extends Modal {
  constructor(app: App, private plugin: MobilePlugin, private line: offset[]) {
    super(app);
  }
  onOpen() {
    new Setting(this.contentEl)
      .setName("Assign Action to New Gesture")
      .setDesc("Select a command to assign to the new gesture.")
      .addButton((btn) =>
        btn.setButtonText("Select Command").onClick(() => {
          new CommandSuggestModal(this.app, async (command: Command) => {
            // Assign selected command to the new gesture
            this.plugin.settings.gestureCommands.push({
              name: command.name || "unnamed",
              commandId: command.id,
              line: this.line.map((p) => [
                Number(p.x.toFixed(2)),
                Number(p.y.toFixed(2)),
              ]),
            });

            await this.plugin.saveSettings();
            this.close();
          }).open();
          this.close();
        })
      );
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
