import { App, Component, Platform } from 'obsidian';

/**
 * Component that forces tablet mode on phone devices.
 *
 * When loaded, this component overrides the phone detection and
 * sets the platform to tablet mode, providing a desktop-like experience
 * on mobile devices. The original state is restored when unloaded.
 *
 * @extends Component
 */

export class keepInTabletMode extends Component {
  isloaded = false;
  wasPhone = false;
  constructor(public app: App) {
    super();
  }

  onload(): void {
    this.isloaded = true;
    this.wasPhone = Platform.isPhone;
    if (Platform.isPhone) {
      this.toggleTabletMode(true);
    }
    this.registerEvent(
      this.app.workspace.on('resize', () => {
        if (Platform.isPhone) {
          this.wasPhone = true;
          this.toggleTabletMode(true);
        }
      }),
    );
  }

  private toggleTabletMode(isTablet: boolean) {
    Platform.isPhone = !isTablet;
    Platform.isTablet = isTablet;
    document.body.toggleClass('is-tablet', Platform.isTablet);
    document.body.toggleClass('is-phone', Platform.isPhone);
  }

  onunload(): void {
    this.isloaded = false;
    if (this.wasPhone) this.toggleTabletMode(false);
  }
}
