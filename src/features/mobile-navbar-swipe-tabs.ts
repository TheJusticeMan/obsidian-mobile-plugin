import { App, Component } from 'obsidian';

const SWIPE_THRESHOLD_PX = 30;

export class MobileNavbarSwipeTabs extends Component {
  private startX = 0;

  constructor(private readonly app: App) {
    super();
  }

  onload(): void {
    this.app.workspace.onLayoutReady(() => {
      const mobileNavbar = this.app.mobileNavbar?.containerEl;
      if (!mobileNavbar) return;

      this.registerDomEvent(mobileNavbar, 'touchstart', event => {
        this.startX = event.touches[0]?.clientX ?? 0;
      });

      this.registerDomEvent(mobileNavbar, 'touchend', event => {
        const endX = event.changedTouches[0]?.clientX ?? this.startX;
        const deltaX = endX - this.startX;

        if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;

        this.app.commands?.executeCommandById(
          deltaX < 0 ? 'workspace:next-tab' : 'workspace:previous-tab',
        );
      });
    });
  }
}