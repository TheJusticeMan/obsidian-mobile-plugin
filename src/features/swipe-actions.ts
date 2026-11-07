import { Component } from 'obsidian';
import type { App, EventRef } from 'obsidian';
import MobilePlugin from '../main';
import { SwipeActionEvent } from '../settings';

type SwipeEventData = {
  direction?: string;
  points?: number;
  startY?: number;
  y?: number;
  targetEl?: HTMLElement;
};

type WorkspaceWithSwipe = {
  on: (
    eventName: string,
    callback: (data?: SwipeEventData) => void,
  ) => EventRef;
  rootSplit?: {
    containerEl?: HTMLElement;
  };
};

export class SwipeActions extends Component {
  constructor(
    private readonly app: App,
    private readonly plugin: MobilePlugin,
  ) {
    super();
  }

  onload(): void {
    const workspace = this.app.workspace as WorkspaceWithSwipe;
    this.registerEvent(workspace.on('swipe', data => this.handleSwipe(data)));
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
