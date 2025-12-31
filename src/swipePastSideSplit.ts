import apocalypseThrottle from 'apocalypse-throttle';
import {
  App,
  Component,
  ExtraButtonComponent,
  WorkspaceLeaf,
  WorkspaceMobileDrawer,
  WorkspaceSidedock,
} from 'obsidian';
import { Offset } from './gesture-handler';
import { VIEW_TYPE_TABS } from './TabsLeaf';

/**
 * The goal is to make it quick to switch between tabs in the side splits by swiping farther than the edge.
 */
export class SwipePastSideSplit extends Component {
  start: Offset | null = null;
  swipeEl: SideSplitSwipeElement;

  constructor(public app: App) {
    super();
    this.swipeEl = new SideSplitSwipeElement(this.app, this, 'left');
  }

  onload(): void {
    this.app.workspace.onLayoutReady(() => {
      const { leftSplit, rightSplit } = this.app.workspace;
      if (!leftSplit || !rightSplit) {
        return;
      }
      this.registerDomEvent(leftSplit.containerEl, 'touchstart', e =>
        this.touchStartHandler(e, 'left'),
      );
      this.registerDomEvent(rightSplit.containerEl, 'touchstart', e =>
        this.touchStartHandler(e, 'right'),
      );
    });
  }

  touchStartHandler(e: TouchEvent, side: 'left' | 'right') {
    this.start = new Offset(e.touches[0].clientX, e.touches[0].clientY);
    const split =
      side === 'right'
        ? this.app.workspace.rightSplit.containerEl
        : this.app.workspace.leftSplit.containerEl;

    this.swipeEl.side = side;
    this.swipeEl.start = this.start;
    /* this.swipeEl.open(); */

    this.swipeEl.component.registerDomEvent(
      split,
      'touchmove',
      this.touchMoveHandler,
    );
    this.swipeEl.component.registerDomEvent(
      split,
      'touchend',
      this.touchEndHandler,
    );
  }

  touchMoveHandler = (e: TouchEvent) => {
    if (!this.start) return;
    const current = new Offset(e.touches[0].clientX, e.touches[0].clientY);
    const delta = current.subtract(this.start);
    const deltaX = current.x - this.start.x;
    if (Math.abs(delta.y) > Math.abs(delta.x)) {
      // Vertical scroll, ignore
      return;
    }

    this.swipeEl.update(deltaX);
  };

  touchEndHandler = (e: TouchEvent) => {
    if (this.start && this.swipeEl.isActive) {
      this.swipeEl.containerEl.setCssProps({ transform: '' });
      this.swipeEl.containerEl.addClass('is-active');
    } else {
      this.swipeEl.close();
    }

    this.start = null;
  };

  onunload(): void {
    this.swipeEl.close();
  }
}

class SideSplitSwipeElement {
  isActive: boolean = false;
  isOpen: boolean = false;
  component: Component = new Component();
  start: Offset | null = null;
  containerEl: HTMLElement;
  contentEl: HTMLElement;

  constructor(
    public app: App,
    public parent: SwipePastSideSplit,
    public side: 'left' | 'right',
  ) {
    this.containerEl = document.body.createDiv({ cls: 'swipe-past-overlay' });
    this.containerEl.detach();
    this.containerEl.createEl('h2', {
      text: `Select ${this.side} sidebar tab`,
      cls: 'swipe-past-header',
    });
    this.contentEl = this.containerEl.createDiv({ cls: 'swipe-past-content' });
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    this.parent.addChild(this.component);
    this.containerEl.addClass(`from-${this.side}`);
    this.containerEl.removeClass(
      `from-${this.side === 'left' ? 'right' : 'left'}`,
    );
    document.body.appendChild(this.containerEl);

    this.contentEl.empty();

    this.component.registerDomEvent(this.containerEl, 'touchstart', e =>
      this.touchStartHandler(e),
    );
    this.component.registerDomEvent(this.containerEl, 'touchmove', e =>
      this.touchMoveHandler(e),
    );
    this.component.registerDomEvent(this.containerEl, 'touchend', e =>
      this.touchEndHandler(e),
    );
    this.render(
      this.side === 'left'
        ? this.app.workspace.leftSplit
        : this.app.workspace.rightSplit,
    );
  }

  touchStartHandler(e: TouchEvent) {
    this.start = new Offset(e.touches[0].clientX, e.touches[0].clientY);
  }

  touchMoveHandler = apocalypseThrottle((e: TouchEvent) => {
    if (!this.start) return;
    const current = new Offset(e.touches[0].clientX, e.touches[0].clientY);
    const deltaX = current.x - this.start.x;

    let translate = '';
    if (this.side === 'left') {
      if (deltaX < 0) {
        translate = `translateX(${deltaX}px)`;
      }
    } else {
      if (deltaX > 0) {
        translate = `translateX(${deltaX}px)`;
      }
    }

    if (translate) {
      this.containerEl.style.transform = translate;
    } else {
      this.containerEl.setCssProps({ transform: '' });
    }
  }, 16);

  touchEndHandler(e: TouchEvent) {
    if (!this.start) return;
    const current = new Offset(
      e.changedTouches[0].clientX,
      e.changedTouches[0].clientY,
    );
    const deltaX = current.x - this.start.x;

    const threshold = 25;
    let shouldClose = false;

    if (this.side === 'left') {
      shouldClose = deltaX < -threshold;
    } else {
      shouldClose = deltaX > threshold;
    }

    if (shouldClose) {
      this.close();
    } else {
      this.containerEl.setCssProps({ transform: '' });
    }
    this.start = null;
  }

  update(deltaX: number) {
    let translate = '';

    const threshold = 25;
    if (this.side === 'left') {
      // Swiping right
      const x = Math.max(0, deltaX - threshold);
      translate = `translateX(calc(-100% + ${x}px))`;
      this.isActive = x > 0;
    } else {
      // Swiping left
      const x = Math.min(0, deltaX + threshold);
      translate = `translateX(calc(100% + ${x}px))`;
      this.isActive = x < 0;
    }

    if (!this.isActive && this.isOpen) this.close();
    if (this.isActive && !this.isOpen) this.open();

    this.containerEl.style.transform = translate;
  }

  render(side: WorkspaceSidedock | WorkspaceMobileDrawer) {
    const sidebarLeaves: WorkspaceLeaf[] = [];

    this.app.workspace.iterateAllLeaves(leaf => {
      // Check if the leaf's root container is the right sidebar
      if (leaf.getRoot() === side) sidebarLeaves.push(leaf);
    });

    this.contentEl.empty();

    // Create a container for the stack to center it properly
    const stackContainer = this.contentEl.createDiv({
      cls: 'swipe-past-stack-container',
    });

    sidebarLeaves.forEach(leaf => {
      const div = stackContainer.createDiv('swipe-past-option');
      if (leaf.isVisible()) div.addClass('is-active');
      new ExtraButtonComponent(div).setIcon(leaf.getIcon());
      div.createSpan({ text: leaf.getDisplayText() });
      new ExtraButtonComponent(div)
        .setIcon('cross')
        .onClick(() =>
          this.app.workspace.detachLeavesOfType(leaf.view.getViewType()),
        );
      div.onclick = async () => {
        await this.app.workspace.revealLeaf(leaf);
        this.close();
      };
    });
    if (this.side === 'left') {
      const div = stackContainer.createDiv('swipe-past-option');
      new ExtraButtonComponent(div).setIcon('settings');
      div.createSpan({ text: 'Settings' });

      div.onclick = () => {
        this.app.commands.executeCommandById('app:open-settings');
        this.close();
      };
    } else if (
      !sidebarLeaves.some(leaf => leaf.view.getViewType() === VIEW_TYPE_TABS)
    ) {
      const div = stackContainer.createDiv('swipe-past-option');
      new ExtraButtonComponent(div).setIcon('tabs');
      div.createSpan({ text: 'Tabs' });

      div.onclick = () => {
        this.app.commands.executeCommandById('mobile:open-tabs');
        this.close();
      };
    }
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;

    this.containerEl.removeClass('is-active');
    this.containerEl.addClass('is-closing');
    setTimeout(() => {
      this.containerEl.removeClass('is-closing');
      this.containerEl.detach();
    }, 300);
    this.containerEl.setCssProps({ transform: '' });
    this.parent.start = null;
    this.parent.removeChild(this.component);
  }
}
