// The first-visit card (Derek's request): someone opening the game for the
// first time is pointed at "Grow a town", or sent off to build their own.
// It shows once per browser, and only on an island with nothing built yet,
// so a saved town or a shared link never gets it.

import { el } from './dom';

const KEY = 'lc:welcomed';

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false; // No storage (private mode): show it; it is one click to dismiss.
  }
}

function remember(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Nothing to do: it will show again next visit.
  }
}

export interface WelcomeHost {
  /** True when the island already has a town on it. */
  hasTown(): boolean;
  growTown(): void;
}

/** Shows the card if this is a first visit to an empty island. Returns a function that takes it down (without marking it seen). */
export function maybeWelcome(root: HTMLElement, host: WelcomeHost): () => void {
  if (seen() || host.hasTown()) return () => {};
  const remove = (): void => {
    veil.remove();
    window.removeEventListener('keydown', onKey, true);
  };
  const close = (): void => {
    remember();
    remove();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  const grow = el('button', {
    class: 'lc-text-btn lc-primary',
    text: 'Grow a town',
    attrs: { type: 'button', 'data-ui': 'welcome-grow' },
    on: {
      click: () => {
        close();
        host.growTown();
      },
    },
  });
  const card = el('div', { class: 'lc-card lc-welcome', attrs: { 'data-ui': 'welcome', role: 'dialog', 'aria-label': 'Welcome to Little City' } }, [
    el('h2', { text: 'Welcome to Little City' }),
    el('p', { text: 'Try growing a town to see what this island can become, or build your own, block by block.' }),
    el('div', { class: 'lc-welcome-buttons' }, [
      grow,
      el('button', { class: 'lc-text-btn', text: 'Build my own', attrs: { type: 'button', 'data-ui': 'welcome-build' }, on: { click: close } }),
    ]),
    el('small', { text: 'You can grow a town any time from the menu at the top left.' }),
  ]);
  // The veil catches clicks beside the card, so a stray click closes it instead of placing a block.
  const veil = el('div', { class: 'lc-welcome-veil', attrs: { 'data-ui': 'welcome-veil' }, on: { click: (e) => { if (e.target === veil) close(); } } }, [card]);
  root.append(veil);
  window.addEventListener('keydown', onKey, true);
  grow.focus({ preventScroll: true });
  return remove;
}
