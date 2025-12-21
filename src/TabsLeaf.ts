import { IconName, ItemView } from 'obsidian';

export const VIEW_TYPE_TABS = 'tabs-leaf';

export class TabsLeaf extends ItemView {
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

    this.app.workspace.iterateRootLeaves(leaf => {
      const tabDiv = this.contentEl.createDiv({
        cls:
          leaf === activeLeaf
            ? 'mobile-search-result-card is-active'
            : 'mobile-search-result-card',
        text: leaf.getDisplayText(),
      });
      tabDiv.addEventListener('mouseup', () => {
        this.app.workspace.setActiveLeaf(leaf, { focus: true });
      });
    });
  };
}
