// The held-length stepper (design section 7, "Held length"): a small − n +
// beside the tray, shown only while a piece with a length is selected. It
// does what scrolling over the island does, and it is the only way on touch.
// Owner: Interface.

import { el, iconButton } from './dom';
import { MAX_LENGTH } from './length';

export interface Stepper {
  readonly el: HTMLElement;
  /** Shows the length, or hides the stepper when the selected piece has none. */
  show(length: number | null): void;
}

export function createStepper(change: (by: number) => void): Stepper {
  const less = iconButton('less', 'Shorter', { class: 'lc-step', attrs: { 'data-ui': 'length-less' }, on: { click: () => change(-1) } });
  const more = iconButton('more', 'Longer', { class: 'lc-step', attrs: { 'data-ui': 'length-more' }, on: { click: () => change(1) } });
  const value = el('output', { class: 'lc-length-value', attrs: { 'data-ui': 'length-value', 'aria-live': 'polite' } });
  const root = el(
    'div',
    { class: 'lc-card lc-stepper', title: 'Length: scroll over the island, or press − and +', attrs: { role: 'group', 'aria-label': 'Length', 'data-ui': 'length', hidden: '' } },
    [less, value, more],
  );
  return {
    el: root,
    show(length) {
      root.toggleAttribute('hidden', length === null);
      if (length === null) return;
      value.textContent = String(length);
      value.setAttribute('aria-label', `Length ${length}`);
      less.disabled = length <= 1;
      more.disabled = length >= MAX_LENGTH;
    },
  };
}
