// The first-visit note (Derek's request): someone opening the game for the
// first time is pointed at "Grow a town". It is a small closable card beside
// the menu button, never over the town and never in the way of building. It
// shows once per browser and only on an island with nothing built yet, so a
// saved town or a shared link never gets it; it goes away when closed, when
// a town is grown, or as soon as the player starts building.

import { el, iconButton } from './dom';

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

export interface Welcome {
  /** Call when the town changes: the note goes once the player has built something. */
  townChanged(): void;
  /** Takes the note down without marking it seen. */
  dispose(): void;
}

const NONE: Welcome = { townChanged() {}, dispose() {} };

/** Shows the note if this is a first visit to an empty island. */
export function maybeWelcome(root: HTMLElement, host: WelcomeHost): Welcome {
  if (seen() || host.hasTown()) return NONE;
  let open = true;
  const remove = (): void => {
    open = false;
    card.remove();
  };
  const close = (): void => {
    remember();
    remove();
  };
  const card = el('div', { class: 'lc-card lc-welcome', attrs: { 'data-ui': 'welcome', role: 'status', 'aria-label': 'Welcome to Little City' } }, [
    iconButton('close', 'Close', { class: 'lc-welcome-close', attrs: { 'data-ui': 'welcome-close' }, on: { click: close } }),
    el('strong', { text: 'Welcome to Little City' }),
    el('p', { text: 'Try growing a town to see what this island can become, or just start building.' }),
    el('button', {
      class: 'lc-text-btn lc-primary',
      text: 'Grow a town',
      attrs: { type: 'button', 'data-ui': 'welcome-grow' },
      on: {
        click: () => {
          close();
          host.growTown();
        },
      },
    }),
  ]);
  root.append(card);
  return {
    townChanged() {
      if (open && host.hasTown()) close();
    },
    dispose() {
      if (open) remove();
    },
  };
}
