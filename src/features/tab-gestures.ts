import { App, WorkspaceLeaf } from 'obsidian';
import { Offset } from '../utils/gesture-handler';
import MobilePlugin from '../main';
let mobileTabGestures: MobileTabGestures[] = [];

/**
 * Handles touch gestures for tab manipulation in the mobile tab switcher.
 *
 * Provides swipe-to-close and drag-to-reorder functionality for tabs
 * in the mobile tab switcher interface. Supports two gesture modes:
 * - Horizontal swipe: Closes the tab
 * - Vertical drag: Reorders tabs by dragging to new position
 *
 * The gesture detection uses a threshold to determine which mode to use
 * based on the initial drag direction.
 */
class MobileTabGestures {
  private start: Offset = new Offset(0, 0);
  mode: 'swipe' | 'drag' | 'none' = 'none';
  constructor(
    public plugin: MobilePlugin,
    public el: HTMLElement,
    public leaf: WorkspaceLeaf,
  ) {
    el.addEventListener('touchstart', this.onTouchStart, {
      passive: true,
    });
  }

  drop = (position: Offset) => {
    // find the tab under the current mouse position

    const currentLeaf = mobileTabGestures.find(
      mtg =>
        mtg !== this &&
        mtg.el.offsetTop < position.y &&
        mtg.el.offsetTop + mtg.el.offsetHeight > position.y &&
        mtg.el.offsetLeft < position.x &&
        mtg.el.offsetLeft + mtg.el.offsetWidth > position.x,
    );

    const { leafDragging } = this.plugin;

    if (leafDragging && currentLeaf) {
      putLeafOnLeaf(this.plugin.app, leafDragging, currentLeaf.leaf);
    }
  };

  onTouchEnd = (ev: TouchEvent) => {
    this.el.setCssStyles({
      transform: ``,
    });
    const touch = ev.changedTouches[0];
    const end = new Offset(touch.clientX, touch.clientY);
    const delta = end.subtract(this.start);

    if (Math.abs(delta.x) / 2 > Math.abs(delta.y) && this.mode === 'swipe') {
      // Horizontal swipe
      if (delta.x > 50) {
        // Swipe right
        this.leaf.detach();
      } else if (delta.x < -50) {
        // Swipe left
        this.leaf.detach();
      }
    } else if (this.mode === 'drag') {
      this.drop(end);
    }
    this.mode = 'none';
    document.body.removeEventListener('touchmove', this.onTouchMove);
    document.body.removeEventListener('touchend', this.onTouchEnd);
  };

  onTouchMove = (ev: TouchEvent) => {
    const touch = ev.touches[0];
    const current = new Offset(touch.clientX, touch.clientY);
    const delta = current.subtract(this.start);

    if (Math.abs(delta.x) / 2 > Math.abs(delta.y) && this.mode !== 'drag') {
      if (Math.abs(delta.x) > 50) this.mode = 'swipe';
      this.el.setCssStyles({
        transform: `translateX(${delta.x}px)`,
      });
    } else if (
      this.mode !== 'swipe' &&
      this.plugin.settings.enableTabReordering
    ) {
      if (Math.abs(delta.y) > 50) this.mode = 'drag';
      this.el.setCssStyles({
        transform: `translate(${delta.x}px, ${delta.y}px)`,
      });
    } else {
      this.el.setCssStyles({
        transform: ``,
      });
      this.mode = 'none';
    }
  };

  onTouchStart = (ev: TouchEvent) => {
    // make sure the touch is in the middle 25% of the tab to avoid conflicts with scrolling
    const rect = this.el.getBoundingClientRect();
    const middle = new Offset(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    const range = new Offset(rect.width * 0.125, rect.height * 0.125);
    const touch = ev.changedTouches[0];
    if (
      touch.clientX < middle.x - range.x ||
      touch.clientX > middle.x + range.x ||
      touch.clientY < middle.y - range.y ||
      touch.clientY > middle.y + range.y
    ) {
      return;
    }
    this.start = new Offset(touch.clientX, touch.clientY);
    this.plugin.leafDragging = this.leaf;
    document.body.addEventListener('touchmove', this.onTouchMove, {
      passive: false,
    });
    document.body.addEventListener('touchend', this.onTouchEnd, {
      passive: true,
    });
  };

  destroy() {
    this.el.removeEventListener('touchstart', this.onTouchStart);
    document.body.removeEventListener('touchmove', this.onTouchMove);
    document.body.removeEventListener('touchend', this.onTouchEnd);
  }
}

export function updateMobileTabGestures(plugin: MobilePlugin) {
  const { app } = plugin;
  for (const mtg of mobileTabGestures) {
    mtg.destroy();
  }
  mobileTabGestures = [];
  app.workspace.iterateRootLeaves(leaf => {
    const el = (
      app?.mobileTabSwitcher?.tabPreviewLookup as WeakMap<
        WorkspaceLeaf,
        { containerEl: HTMLElement }
      >
    )?.get(leaf)?.containerEl;
    if (!el) return;
    mobileTabGestures.push(new MobileTabGestures(plugin, el, leaf));
  });
}

interface leafWithParent {
  parent: {
    children: WorkspaceLeaf[];
  };
}

function putLeafOnLeaf(
  app: App,
  leaf: WorkspaceLeaf,
  targetLeaf: WorkspaceLeaf,
) {
  app.workspace.iterateRootLeaves(leaf => {
    leaf.detach();
  });
  if (leaf === targetLeaf) return;

  const targetParent = (targetLeaf as unknown as leafWithParent)?.parent;
  const parent = (leaf as unknown as leafWithParent)?.parent;

  // Safety check: Ensure parents exist and have children
  if (!parent?.children || !targetParent?.children) return;

  // Only support reordering within the same parent for now (prevents errors).
  if (parent !== targetParent) return;

  const currentIndex = parent.children.indexOf(leaf);
  const targetIndex = parent.children.indexOf(targetLeaf);

  if (currentIndex === -1 || targetIndex === -1) return;

  // Remove the leaf from its current position.
  parent.children.splice(currentIndex, 1);

  // If the leaf was removed from an index before the target, the target shifts left by 1.
  const insertIndex =
    currentIndex < targetIndex ? targetIndex - 1 : targetIndex;

  // Insert the leaf at the new position.
  parent.children.splice(insertIndex, 0, leaf);

  // Force a UI refresh so it re-renders the tab headers.
  app.workspace.requestSaveLayout();
  app.mobileTabSwitcher?.onLayoutChange();

  // Alternatively, if the UI doesn't snap, you might need to trigger a resize
  // or re-focus the leaf to force a DOM update:
  // leaf.view.onResize();
}
