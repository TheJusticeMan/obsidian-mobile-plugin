import {
  ExtraButtonComponent,
  IconName,
  ItemView,
  WorkspaceLeaf,
} from 'obsidian';
import { SortableList } from 'src/components/SortableList';

export const VIEW_TYPE_TABS = 'tabs-leaf';

/**
 * View component that displays a list of open tabs.
 *
 * Provides a simple list view of all root workspace leaves (tabs),
 * highlighting the active tab and allowing users to switch between tabs
 * by clicking on them. Updates automatically when the layout changes.
 *
 * @extends ItemView
 */
export class TabsLeaf extends ItemView {
  sortedLeaves: WorkspaceLeaf[] = [];
  getViewType(): string {
    return VIEW_TYPE_TABS;
  }

  getDisplayText(): string {
    return 'Tabs';
  }

  getIcon(): IconName {
    return 'tabs';
  }

  onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass('tabs-leaf');
    this.registerEvent(this.app.workspace.on('layout-change', this.ud));
    this.registerEvent(this.app.workspace.on('active-leaf-change', this.ud));
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    return Promise.resolve();
  }

  ud = (): void => {
    this.contentEl.empty();
    const activeLeaf = this.app.workspace.getMostRecentLeaf();

    // Create a container for the stack to center it properly

    const workspaceLeaves: WorkspaceLeaf[] = [];

    this.app.workspace.iterateRootLeaves(leaf => {
      workspaceLeaves.push(leaf);
    });

    // Use a Set or simple concat if you are just trying to aggregate them
    // This avoids the 'overwrite' behavior of some merge functions
    this.sortedLeaves = Array.from(
      new Set([...this.sortedLeaves, ...workspaceLeaves]),
    );

    new SortableList<WorkspaceLeaf>(
      this.contentEl,
      this.sortedLeaves,
      (parent, leaf) => {
        const div = parent.createDiv('swipe-past-option');
        if (leaf === activeLeaf) div.addClass('is-active');

        new ExtraButtonComponent(div).setIcon(leaf.getIcon());
        div.createSpan({ text: leaf.getDisplayText() });
        new ExtraButtonComponent(div)
          .setIcon('cross')
          .onClick(() => leaf.detach());

        div.onclick = async () => {
          this.app.workspace.setActiveLeaf(leaf, { focus: true });
          await this.app.workspace.revealLeaf(leaf);
        };

        return div;
      },
    ).addClass('swipe-past-stack-container');

    /*     this.app.workspace.iterateRootLeaves(leaf => {
      const div = stackContainer.createDiv('swipe-past-option');
      if (leaf === activeLeaf) div.addClass('is-active');

      new ExtraButtonComponent(div).setIcon(leaf.getIcon());
      div.createSpan({ text: leaf.getDisplayText() });
      new ExtraButtonComponent(div)
        .setIcon('cross')
        .onClick(() => leaf.detach());

      div.onclick = async () => {
        this.app.workspace.setActiveLeaf(leaf, { focus: true });
        await this.app.workspace.revealLeaf(leaf);
      };
    });
 */
  };
}
