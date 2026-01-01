import { Setting } from 'obsidian';

export class SortableList<T> {
  elementContainer: HTMLElement;

  constructor(
    parent: HTMLElement,
    private arr: T[],
    private renderCallback?: (
      parent: HTMLElement,
      item: T,
      index: number,
    ) => HTMLElement,
    private updateCallback?: (arr: T[]) => void,
  ) {
    this.elementContainer = parent.createDiv('draggable-container');
    if (this.renderCallback) this.render();
  }

  private render(): boolean {
    /* if (!this.renderCallback) return false; */
    this.elementContainer.empty();

    this.arr.forEach((item, index) => {
      const element =
        this.renderCallback?.(this.elementContainer, item, index) ||
        this.elementContainer.createDiv();
      /* this.el.push(element); */
      element.addClass('draggable-item');
      element.draggable = true;
      let edge: 'top' | 'bottom' | 'none' = 'none';
      const setDragEdgeClasses = (newEdge: 'top' | 'bottom' | 'none') => {
        element.toggleClass('drag-over-top', newEdge === 'top');
        element.toggleClass('drag-over-bottom', newEdge === 'bottom');
        edge = newEdge;
      };
      const listen = <K extends keyof HTMLElementEventMap>(
        eventName: K,
        handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void,
      ) => element.addEventListener(eventName, handler);

      listen('dragstart', e => {
        e.dataTransfer?.setData('text/plain', index.toString());
        element.addClass('is-dragging');
      });

      listen('dragend', () => {
        element.removeClass('is-dragging');
      });

      listen('dragover', e => {
        e.preventDefault();
        const rect = element.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (e.clientY < midY) {
          setDragEdgeClasses('top');
        } else {
          setDragEdgeClasses('bottom');
        }
        element.addClass('is-drag-over');
      });

      listen('dragleave', () => {
        element.removeClass('is-drag-over');
        setDragEdgeClasses('none');
      });

      listen('drop', e => {
        e.preventDefault();
        element.removeClass('is-drag-over');
        const oldIndex = Number(e.dataTransfer?.getData('text/plain'));
        const targetIndex =
          index + Number(edge === 'bottom') - Number(oldIndex < index);
        const item = this.arr.splice(oldIndex, 1)[0];
        this.arr.splice(targetIndex, 0, item);
        this.render();
        this.updateCallback?.(this.arr);
        setDragEdgeClasses('none');
      });
    });
    return true;
  }

  addSetting(cb: (setting: Setting, item: T, index: number) => void): void {
    this.renderCallback = (parent, item, index) => {
      const setting = new Setting(parent);
      cb(setting, item, index);
      return setting.settingEl;
    };
    this.render();
  }

  onUpdate(cb: (arr: T[]) => void): void {
    this.updateCallback = cb;
  }

  addClass(className: string): SortableList<T> {
    this.elementContainer.addClass(className);
    return this;
  }
}
