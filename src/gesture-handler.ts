import { App } from 'obsidian';

export interface GestureCommand {
  name: string;
  commandId: string;
  gesturePath: string;
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

/**
 * Helper function to set CSS properties on an element
 */
function setCssProps(el: HTMLElement, props: Record<string, string>): void {
  Object.assign(el.style, props);
}

export class GestureHandler {
  private start: Offset = new Offset(0, 0);
  private last: Offset = new Offset(0, 0);
  private line: Offset[] = [];

  constructor(
    private app: App,
    private element: HTMLElement,
    private gestureCommands: GestureCommand[],
    private onUnknown: (line: Offset[]) => void,
  ) {
    this.element.addEventListener('touchstart', this.startDrag);
    this.element.addEventListener('mousedown', this.startDrag);
  }

  destroy() {
    this.element.removeEventListener('touchstart', this.startDrag);
    this.element.removeEventListener('mousedown', this.startDrag);
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
    setCssProps(this.element, { translate: `${d.x}px ${d.y}px` });
  };

  endDrag = (): void => {
    setCssProps(this.element, { translate: '0px 0px' });

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

  drawGesture(line: Offset[]): void {
    // start in the middle of the FAB
    const start = new Offset(
      this.element.getBoundingClientRect().left +
        this.element.getBoundingClientRect().width / 2,
      this.element.getBoundingClientRect().top +
        this.element.getBoundingClientRect().height / 2,
    );
    for (let i = 0; i < line.length - 1; i++) {
      this.drawTempline(line[i].add(start), line[i + 1].add(start), 3000);
    }
  }

  detectGesture(): void {
    if (this.line.length < 2) return;
    if (this.getLength(this.line) < 100) return;

    const normalizedInput = this.normalizeLine(this.line);

    let bestMatch = null;
    let minDiff = Infinity;

    for (const gesture of this.gestureCommands) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- JSON.parse returns unknown type
      const normalizedPreset = JSON.parse(gesture.gesturePath).map(
        (p: number[]) => new Offset(p[0], p[1]),
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns unknown type
      const diff = this.calculateDifference(normalizedInput, normalizedPreset);

      if (diff < minDiff) {
        minDiff = diff;
        bestMatch = gesture;
      }
    }

    if (bestMatch && minDiff < 0.5) {
      this.drawGesture(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- JSON.parse returns unknown type
        JSON.parse(bestMatch.gesturePath).map(
          (p: number[]) => new Offset(p[0], p[1]),
        ),
      );
      // Animate FAB to indicate success
      this.element.removeClass('gesture-animating');
      requestAnimationFrame(() => {
        this.element.addClass('gesture-success');
        requestAnimationFrame(() => {
          this.element.addClass('gesture-animating');
          this.element.removeClass('gesture-success');
        });
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Obsidian's commands API is not typed
      (this.app as any).commands?.executeCommandById(bestMatch.commandId);
    } else {
      // Draw the gesture for user feedback
      this.drawGesture(normalizedInput);
      this.onUnknown(normalizedInput);
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
