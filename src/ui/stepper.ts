// The held-length stepper (design section 7, "Held length"): a small − n +
// beside the tray, shown only while a piece with a length is selected. It
// does what scrolling over the island does, and it is the only way on touch.
// Owner: Interface.

import { el, iconButton } from './dom';
import { MAX_LENGTH } from './length';

export interface Stepper {
  readonly el: HTMLElement;
  /** Shows the length, or hides the stepper when the selected piece has none. `max` is the longest it goes. */
  show(length: number | null, max?: number, label?: string): void;
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
    show(length, max = MAX_LENGTH, label = 'Length') {
      root.toggleAttribute('hidden', length === null);
      if (length === null) return;
      value.textContent = String(length);
      value.setAttribute('aria-label', `${label} ${length}`);
      root.setAttribute('aria-label', label);
      root.title = label === 'Length' ? 'Length: scroll over the island, or press − and +' : `${label}: scroll over the island, or press − and +`;
      less.setAttribute('aria-label', label === 'Length' ? 'Shorter' : 'Narrower');
      more.setAttribute('aria-label', label === 'Length' ? 'Longer' : 'Wider');
      less.disabled = length <= 1;
      more.disabled = length >= max;
    },
  };
}
