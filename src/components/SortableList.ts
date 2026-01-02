import { ExtraButtonComponent, Setting } from 'obsidian';

export class SortableList<T> {
  private renderCallback?: (
    parent: HTMLElement,
    item: T,
    index: number,
  ) => HTMLElement;
  private updateCallback?: (context: this) => void;
  contentEl: HTMLElement;

  constructor(
    public parent: HTMLElement,
    public arr: T[],
  ) {
    this.contentEl = parent.createDiv('draggable-container');
    if (this.renderCallback) this.render();
  }

  private render(): boolean {
    /* if (!this.renderCallback) return false; */
    this.contentEl.empty();

    this.arr.forEach((item, index) => {
      const element =
        this.renderCallback?.(this.contentEl, item, index) ||
        this.contentEl.createDiv();
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
        setDragEdgeClasses('none');
      });
    });
    this.updateCallback?.(this);
    return true;
  }

  useSetting(cb: (setting: Setting, item: T, index: number) => void): this {
    this.renderCallback = (parent, item, index) => {
      const setting = new Setting(parent);
      cb(setting, item, index);
      return setting.settingEl;
    };
    this.render();
    return this;
  }

  useBubble(cb: (bubble: Bubble, item: T, index: number) => void): this {
    this.renderCallback = (parent, item, index) => {
      const bubble = new Bubble(parent);
      cb(bubble, item, index);
      return bubble.div;
    };
    this.render();
    return this;
  }

  addBubble(cb: (bubble: Bubble) => void): this {
    cb(new Bubble(this.contentEl));
    return this;
  }

  onRender(cb: (el: HTMLElement, item: T, index: number) => void): this {
    this.renderCallback = (parent: HTMLElement, item: T, index: number) => {
      const el = parent.createDiv();
      cb(el, item, index);
      return el;
    };
    this.render();
    return this;
  }

  onUpdate(cb: (context: this) => void): this {
    this.updateCallback = cb;
    return this;
  }

  addClass(className: string): this {
    this.contentEl.addClass(className);
    return this;
  }
}

export class Bubble {
  _icon1: ExtraButtonComponent;
  _icon2: ExtraButtonComponent;
  div: HTMLElement;
  nameEl: HTMLSpanElement;
  onClickCallback: () => void;
  constructor(parent: HTMLElement) {
    this.div = parent.createDiv('swipe-past-option');
    this.div.addClass('swipe-past-option');

    this._icon1 = new ExtraButtonComponent(this.div);
    this.nameEl = this.div.createSpan();
    this._icon2 = new ExtraButtonComponent(this.div).setIcon('square');

    this.div.onclick = async () => this.onClickCallback?.();
  }

  onClick(callback: () => void): Bubble {
    this.onClickCallback = callback;
    return this;
  }

  setIcon1(icon: string): Bubble {
    this._icon1.setIcon(icon);
    return this;
  }

  setIcon2(icon: string): Bubble {
    this._icon2.setIcon(icon);
    return this;
  }

  icon1(cb: (icon: ExtraButtonComponent) => void): Bubble {
    cb(this._icon1);
    return this;
  }

  icon2(cb: (icon: ExtraButtonComponent) => void): Bubble {
    cb(this._icon2);
    return this;
  }

  setName(name: string): Bubble {
    this.nameEl.textContent = name;
    return this;
  }

  addClass(...className: string[]): Bubble {
    this.div.addClasses(className);
    return this;
  }
}
