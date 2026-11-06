export const MOBILE_TOOLBAR_CLASSES =
  'mobile-plugin-toolbar ignore-onclickoutside kanban-plugin__ignore-click-outside';

/** Keep toolbar taps from stealing focus from the editor underneath. */
export function preventToolbarFocusLoss(element: HTMLElement): void {
  element.addEventListener('mousedown', event => event.preventDefault(), true);
}
