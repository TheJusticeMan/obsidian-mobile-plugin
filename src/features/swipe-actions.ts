import { App, Component } from 'obsidian';
import MobilePlugin from '../main';
import { SwipeActionEvent } from '../settings';

type SwipeEventData = {
  direction?: string;
  points?: number;
  startY?: number;
  y?: number;
  targetEl?: HTMLElement;
};

type WorkspaceWithTrigger = {
  trigger: (eventName: string, data?: SwipeEventData) => unknown;
  rootSplit?: {
    containerEl?: HTMLElement;
  };
};

export class SwipeActions extends Component {
  private originalTrigger: WorkspaceWithTrigger['trigger'] | null = null;
  private patchedWorkspace: WorkspaceWithTrigger | null = null;

  constructor(
    private readonly app: App,
    private readonly plugin: MobilePlugin,
  ) {
    super();
  }

  onload(): void {
    const workspace = this.app.workspace as WorkspaceWithTrigger;
    if (typeof workspace.trigger !== 'function' || this.originalTrigger) {
      return;
    }

    this.originalTrigger = workspace.trigger.bind(workspace);
    this.patchedWorkspace = workspace;

    workspace.trigger = (eventName: string, data?: SwipeEventData) => {
      if (eventName === 'swipe') {
        this.handleSwipe(data);
      }

      return this.originalTrigger?.(eventName, data);
    };

    this.register(() => this.restoreTrigger());
  }

  onunload(): void {
    this.restoreTrigger();
  }

  private restoreTrigger(): void {
    if (!this.patchedWorkspace || !this.originalTrigger) {
      return;
    }

    this.patchedWorkspace.trigger = this.originalTrigger;
    this.patchedWorkspace = null;
    this.originalTrigger = null;
  }

  private handleSwipe(data?: SwipeEventData): void {
    if (
      !data ||
      data.direction !== 'y' ||
      !data.targetEl ||
      !this.app.workspace.rootSplit?.containerEl?.contains(data.targetEl)
    ) {
      return;
    }

    if (
      data.points === 2 &&
      typeof data.startY === 'number' &&
      typeof data.y === 'number' &&
      data.y > data.startY
    ) {
      this.runAction('twoFingerSwipeDown');
      return;
    }

    if (
      data.points === 1 &&
      typeof data.startY === 'number' &&
      typeof data.y === 'number' &&
      data.y < data.startY
    ) {
      this.runAction('noteBottomSwipeUp');
    }
  }

  private runAction(event: SwipeActionEvent): void {
    const commandId = this.plugin.settings.swipeActions[event];
    if (!commandId) {
      return;
    }

    this.app.commands.executeCommandById(commandId);
  }
}
