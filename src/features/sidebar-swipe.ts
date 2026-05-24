import {
  App,
  Component,
  setIcon,
  WorkspaceLeaf,
  WorkspaceMobileDrawer,
  WorkspaceSidedock,
} from 'obsidian';
import { Offset } from '../utils/gesture-handler';
import { VIEW_TYPE_TABS } from '../views/TabsLeaf';

/**
 * The goal is to make it quick to switch between tabs in the side splits by swiping farther than the edge.
 */
export class SwipePastSideSplit extends Component {
  constructor(public app: App) {
    super();
  }

  onload(): void {
    this.addChild(new SidePullout(this.app));
  }
}

class SidePullout extends Component {
  isOpen: boolean = false;
  startIndex: number = 0;
  currentIndex: number | null = null;
  selectedIndex: number | null = null;
  contentEl: HTMLDivElement | null = null;
  itemEls: HTMLElement[] = [];
  sidebarLeaves: WorkspaceLeaf[] = [];
  activeSide: 'left' | 'right' | null = null;
  activeDock: WorkspaceSidedock | WorkspaceMobileDrawer | null = null;
  gestureSession: Component | null = null;
  closeTimeoutId: number | null = null;

  constructor(public app: App) {
    super();
  }

  onload(): void {
    this.register(() => {
      this.endGestureSession();
      this.clearCloseTimeout();
      this.destroyContentEl();
    });

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
    const dock =
      side === 'right'
        ? this.app.workspace.rightSplit
        : this.app.workspace.leftSplit;
    if (!dock) return;

    this.startGestureSession();

    const start = new Offset(e.touches[0].clientX, e.touches[0].clientY);
    const split = window.activeDocument.body;
    let finished = false;

    const finishGesture = () => {
      if (finished) return;
      finished = true;
      this.endGestureSession();
    };

    const touchMoveHandler = (e: TouchEvent) => {
      const current = new Offset(e.touches[0].clientX, e.touches[0].clientY);
      const delta = current.subtract(start);
      if (!this.isOpen) {
        if (Math.abs(delta.y) > Math.abs(delta.x)) {
          // Vertical scroll, ignore
          return;
        }
        if (side === 'left' && delta.x > 50) {
          // Swiped right on left sidebar
          this.open('left', dock);
        } else if (side === 'right' && delta.x < -50) {
          // Swiped left on right sidebar
          this.open('right', dock);
        }
      } else {
        // Once open, keep vertical drag active until touchend commits or closes it.
        const index = this.startIndex + Math.round(delta.y / 50);
        this.selectIndex(index);
      }
    };

    const touchEndHandler = () => {
      finishGesture();
      if (this.isOpen && this.selectedIndex !== null) {
        this.commitSelection(this.selectedIndex);
      } else if (this.isOpen) {
        this.close();
      }
    };

    const touchCancelHandler = () => {
      finishGesture();
      this.close();
    };

    const session = this.gestureSession;
    if (!session) return;

    session.registerDomEvent(split, 'touchmove', touchMoveHandler);
    session.registerDomEvent(split, 'touchend', touchEndHandler);
    session.registerDomEvent(split, 'touchcancel', touchCancelHandler);
  }

  private startGestureSession(): void {
    this.endGestureSession();
    const session = new Component();
    this.addChild(session);
    this.gestureSession = session;
  }

  private endGestureSession(): void {
    if (!this.gestureSession) return;
    this.removeChild(this.gestureSession);
    this.gestureSession = null;
  }

  private clearCloseTimeout(): void {
    if (this.closeTimeoutId === null) return;
    window.clearTimeout(this.closeTimeoutId);
    this.closeTimeoutId = null;
  }

  private destroyContentEl(): void {
    const contentEl = this.contentEl;
    this.contentEl = null;
    if (!contentEl) return;

    contentEl.removeClass('side-pullout-open');
    contentEl.removeClass('side-pullout-closing');
    contentEl.detach();
  }

  private open(
    side: 'left' | 'right',
    dock: WorkspaceSidedock | WorkspaceMobileDrawer,
  ) {
    if (this.isOpen) return;

    this.isOpen = true;
    this.activeSide = side;
    this.activeDock = dock;
    this.sidebarLeaves = this.collectSidebarLeaves(dock);
    this.startIndex = Math.max(
      0,
      this.sidebarLeaves.findIndex(leaf => leaf.isVisible()),
    );
    this.currentIndex = this.startIndex;
    this.selectedIndex = this.startIndex;
    this.render();
  }

  private collectSidebarLeaves(
    dock: WorkspaceSidedock | WorkspaceMobileDrawer,
  ): WorkspaceLeaf[] {
    const sidebarLeaves: WorkspaceLeaf[] = [];

    this.app.workspace.iterateAllLeaves(leaf => {
      if (leaf.getRoot() === dock) sidebarLeaves.push(leaf);
    });

    return sidebarLeaves;
  }

  render(): void {
    if (!this.isOpen || !this.activeSide || !this.activeDock) {
      return;
    }

    this.sidebarLeaves = this.collectSidebarLeaves(this.activeDock);
    const visibleIndex = this.sidebarLeaves.findIndex(leaf => leaf.isVisible());
    if (visibleIndex !== -1 && this.currentIndex === null) {
      this.currentIndex = visibleIndex;
    }

    this.clearCloseTimeout();
    this.destroyContentEl();
    this.contentEl = window.activeDocument.body.createDiv({
      cls: 'side-pullout',
    });

    const c = this.contentEl;

    c.empty();

    c.addClass(`side-pullout-from-${this.activeSide}`);
    c.removeClass(
      `side-pullout-from-${this.activeSide === 'left' ? 'right' : 'left'}`,
    );
    c.addClass('side-pullout-open');

    c.createEl('h2', {
      text: `${this.activeSide} sidebar`,
      cls: 'side-pullout-header',
    });

    const actions = c.createDiv({ cls: 'side-pullout-actions' });
    if (this.activeSide === 'left') {
      const settingsButton = actions.createEl('button', {
        cls: 'side-pullout-action',
        attr: { type: 'button', 'aria-label': 'Open settings' },
      });
      setIcon(settingsButton, 'settings');
      settingsButton.onclick = () => {
        this.app.commands.executeCommandById('app:open-settings');
        this.close();
      };
    } else if (
      !this.sidebarLeaves.some(
        leaf => leaf.view.getViewType() === VIEW_TYPE_TABS,
      )
    ) {
      const tabsButton = actions.createEl('button', {
        cls: 'side-pullout-action',
        attr: { type: 'button', 'aria-label': 'Open tabs' },
      });
      setIcon(tabsButton, 'tabs');
      tabsButton.onclick = () => {
        this.app.commands.executeCommandById('mobile:open-tabs');
        this.close();
      };
    }

    const rail = c.createDiv({ cls: 'side-pullout-rail-list' });
    this.itemEls = [];

    this.sidebarLeaves.forEach((leaf, index) => {
      const item = rail.createEl('button', {
        cls: 'side-pullout-item',
        attr: { type: 'button', 'aria-label': leaf.getDisplayText() },
      });
      this.itemEls[index] = item;

      setIcon(item, leaf.getIcon());
      item.onclick = () => {
        void this.app.workspace.revealLeaf(leaf);
        this.close();
      };

      if (
        index === this.selectedIndex ||
        leaf.isVisible() ||
        index === visibleIndex
      ) {
        item.addClass('is-active');
      }
    });

    this.updateActiveOption();
  }

  private selectIndex(index: number): void {
    if (!this.sidebarLeaves.length) return;

    const clampedIndex = Math.max(
      0,
      Math.min(this.sidebarLeaves.length - 1, index),
    );

    if (clampedIndex === this.currentIndex) return;

    this.currentIndex = clampedIndex;
    this.selectedIndex = clampedIndex;
    this.updateActiveOption();
  }

  private updateActiveOption(): void {
    this.itemEls.forEach((el, index) => {
      if (!el) return;
      el.toggleClass('is-active', index === this.selectedIndex);
    });
  }

  private commitSelection(index: number): void {
    const leaf = this.sidebarLeaves[index];
    if (!leaf) {
      this.close();
      return;
    }

    void this.app.workspace.revealLeaf(leaf);
    this.close();
  }

  close(): void {
    if (!this.isOpen) return;

    this.endGestureSession();
    this.isOpen = false;
    this.activeSide = null;
    this.activeDock = null;
    this.startIndex = 0;
    this.currentIndex = null;
    this.selectedIndex = null;
    this.sidebarLeaves = [];
    this.itemEls = [];

    const contentEl = this.contentEl;
    this.contentEl = null;
    if (!contentEl) return;

    this.clearCloseTimeout();
    contentEl.removeClass('side-pullout-open');
    contentEl.addClass('side-pullout-closing');
    contentEl.setCssProps({ transform: '' });

    const timeoutId = window.setTimeout(() => {
      contentEl.removeClass('side-pullout-closing');
      contentEl.detach();
      if (this.closeTimeoutId === timeoutId) {
        this.closeTimeoutId = null;
      }
    }, 300);
    this.closeTimeoutId = timeoutId;
  }
}
