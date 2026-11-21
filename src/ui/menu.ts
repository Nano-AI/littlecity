// The ☰ menu (design section 7): grow a town (design 15a: a second screen
// asks where, on this island or on a new one, and a third what kind of town),
// new island (a second screen asks what kind of island, and says the town
// there is now will be gone), share link, postcard, town file out and in,
// and sound. (The dev tuning panel is not in the game: removed at Derek's
// request, 2026-11-20. It lives on in the gallery.)
//
// A choice whose work takes a while (finding an island of a kind) returns a
// promise: the menu stays open with that row marked as working and the rest
// put aside until it is done; closing the menu or Back calls it off.
// Owner: Interface.

import { ISLAND_KIND_NAMES, ISLAND_KINDS, type IslandKind } from '@/terrain/kinds';
import { CHARACTER_NAMES, CHARACTERS, type Character } from '@/townmaker/character';
import { el, iconButton, setIcon } from './dom';

/** What a choice does; a promise keeps the menu open, working, until it settles. */
export type Work = void | Promise<unknown>;

export interface MenuActions {
  /** Fills this island with a grown town: of this kind, or (null) the kind the dice choose, as before. */
  growTown(kind: Character | null, signal: AbortSignal): Work;
  /** Grows a town on a new island: one that suits the kind asked for, or (null) any island and the dice's kind. */
  growNewIsland(kind: Character | null, signal: AbortSignal): Work;
  /**
   * Which kinds of town this island can grow: true, false, or null while the planner is still being
   * asked (then `ready` hears each answer).
   */
  townKindsHere(ready: (kind: Character, ok: boolean) => void): Record<Character, boolean | null>;
  /** The island holds more than its starting trees: leaving it says the town will be gone. */
  hasTown(): boolean;
  /** A new island of this kind, or (null) any. The signal says the player called it off. */
  newIsland(kind: IslandKind | null, signal: AbortSignal): Work;
  shareLink(): void;
  postcard(): void;
  downloadTown(): void;
  openTownFile(file: File): void;
  /** Sound on or off; the menu shows the current state. */
  sound(): boolean;
  setSound(on: boolean): void;
  /** Mischief (design section 13b): the town mends its own damage. Left out of the menu when absent. */
  rebuild?(): boolean;
  setRebuild?(on: boolean): void;
}

export interface Menu {
  /** The ☰ button. */
  readonly button: HTMLButtonElement;
  /** The pop-up, hidden until the button is pressed. */
  readonly el: HTMLElement;
  /** The hidden file chooser behind "Open a town file"; it lives beside the menu, not in it. */
  readonly file: HTMLInputElement;
  readonly isOpen: boolean;
  open(): void;
  close(): void;
}

/** "harbour town" → "Harbour town". */
const capital = (s: string): string => s[0]!.toUpperCase() + s.slice(1);

export function createMenu(actions: MenuActions): Menu {
  const panel = el('div', { class: 'lc-pop lc-menu', attrs: { role: 'menu', hidden: '', 'data-ui': 'menu' } });
  const button = iconButton('menu', 'Menu', {
    class: 'lc-round',
    attrs: { 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'data-ui': 'menu-button' },
  });
  const file = el('input', { attrs: { type: 'file', accept: '.littlecity,.txt,text/plain', hidden: '', 'data-ui': 'town-file' } });
  file.addEventListener('change', () => {
    const chosen = file.files?.[0];
    file.value = '';
    if (chosen) actions.openTownFile(chosen);
  });

  /** The choice under way, while its work takes a while. */
  let pending: AbortController | null = null;
  const callOff = (): void => {
    pending?.abort();
    pending = null;
    panel.classList.remove('lc-working');
  };

  /** Runs a choice: the menu closes at once, or when its work is done. */
  const choose = (row: HTMLButtonElement, run: (signal: AbortSignal) => Work): void => {
    callOff();
    const ctl = new AbortController();
    const work = run(ctl.signal);
    if (!(work instanceof Promise)) return api.close();
    pending = ctl;
    row.classList.add('lc-busy');
    row.setAttribute('aria-busy', 'true');
    panel.classList.add('lc-working');
    const done = (): void => {
      if (pending !== ctl) return;
      pending = null;
      api.close();
    };
    work.then(done, done);
  };

  const item = (id: string, iconId: string, label: string, run: () => void, keepOpen = false): HTMLButtonElement =>
    iconButton(iconId, label, {
      class: 'lc-menu-item',
      showLabel: true,
      attrs: { role: 'menuitem', 'data-menu': id },
      on: {
        click: () => {
          if (!keepOpen) api.close();
          run();
        },
      },
    });

  /** A row of a kind screen: its icon and a bare label. */
  const kindItem = (id: string, iconId: string, label: string, run: (signal: AbortSignal) => Work): HTMLButtonElement => {
    const row: HTMLButtonElement = iconButton(iconId, label, {
      class: 'lc-menu-item',
      showLabel: true,
      attrs: { role: 'menuitem', 'data-menu': id },
      on: { click: () => choose(row, run) },
    });
    return row;
  };

  const back = (id: string, to: () => void): HTMLElement =>
    el('div', { class: 'lc-confirm-buttons' }, [
      el('button', {
        class: 'lc-text-btn',
        text: 'Back',
        attrs: { type: 'button', 'data-menu': id },
        on: {
          click: () => {
            callOff();
            to();
          },
        },
      }),
    ]);

  /** The line under a kind screen's question when the town there is now would go. */
  const losing = (): HTMLElement | null => (actions.hasTown() ? el('small', { text: 'The town you have now will be gone.' }) : null);

  const showItems = (): void => {
    const soundOn = actions.sound();
    const sound = item(
      'sound',
      soundOn ? 'sound-on' : 'sound-off',
      soundOn ? 'Sound: on' : 'Sound: off',
      () => {
        const next = !actions.sound();
        actions.setSound(next);
        setIcon(sound, next ? 'sound-on' : 'sound-off');
        sound.querySelector('.lc-btn-label')!.textContent = next ? 'Sound: on' : 'Sound: off';
        sound.setAttribute('aria-label', next ? 'Sound: on' : 'Sound: off');
      },
      true,
    );
    const label = (on: boolean): string => (on ? 'Rebuild: on' : 'Rebuild: off');
    const rebuild =
      actions.rebuild && actions.setRebuild
        ? item(
            'rebuild',
            'mend',
            label(actions.rebuild()),
            () => {
              const next = !actions.rebuild!();
              actions.setRebuild!(next);
              rebuild!.querySelector('.lc-btn-label')!.textContent = label(next);
              rebuild!.setAttribute('aria-label', label(next));
            },
            true,
          )
        : null;
    panel.replaceChildren(
      item('grow', 'grow', 'Grow a town', showGrow, true),
      el('div', { class: 'lc-menu-rule' }),
      item('new', 'island', 'New island', showIslandKinds, true),
      item('share', 'share', 'Share link', actions.shareLink),
      item('postcard', 'postcard', 'Postcard', actions.postcard),
      el('div', { class: 'lc-menu-rule' }),
      item('download', 'download', 'Save town to a file', actions.downloadTown),
      item('open', 'open', 'Open a town file', () => file.click()),
      el('div', { class: 'lc-menu-rule' }),
      sound,
      ...(rebuild ? [rebuild] : []),
    );
  };

  /** Grow a town, second screen: where. On this island (over whatever is here) or on a new one. */
  const showGrow = (): void => {
    // The planner's word on the kinds that may fall back takes a moment: ask now, while the player reads.
    actions.townKindsHere(() => {});
    panel.replaceChildren(
      el('div', { class: 'lc-confirm lc-choice', attrs: { 'data-ui': 'grow-choice' } }, [
        el('p', { text: 'Grow a town' }),
        item('grow-here', 'grow', 'On this island', () => showTownKinds('here'), true),
        item('grow-new', 'island', 'On a new island', () => showTownKinds('new'), true),
        back('grow-back', showItems),
      ]),
    );
  };

  /**
   * Grow a town, third screen: what kind. Surprise me first (the dice, as before), then the eight
   * kinds. On this island a kind it cannot grow is shown greyed; on a new island every kind is
   * offered and an island is found to suit it.
   */
  const showTownKinds = (where: 'here' | 'new'): void => {
    const rows = new Map<Character, HTMLButtonElement>();
    const mark = (kind: Character, ok: boolean | null): void => {
      const row = rows.get(kind)!;
      row.disabled = ok !== true;
      if (ok === null) row.setAttribute('aria-busy', 'true');
      else row.removeAttribute('aria-busy');
      row.dataset.can = ok === null ? 'checking' : String(ok);
    };
    const grow = (kind: Character | null) => (signal: AbortSignal) => (where === 'here' ? actions.growTown(kind, signal) : actions.growNewIsland(kind, signal));
    for (const kind of CHARACTERS) rows.set(kind, kindItem(`town-${kind}`, `town-${kind}`, capital(CHARACTER_NAMES[kind]), grow(kind)));
    const any = kindItem('town-any', 'dice', 'Surprise me', grow(null));
    any.classList.add('lc-kind-any');
    const screen = el('div', { class: 'lc-confirm lc-choice lc-kinds lc-kinds-wide', attrs: { 'data-ui': 'town-kinds', 'data-where': where } }, [
      el('p', { text: 'What kind of town?' }),
      where === 'new' ? losing() : null,
      el('div', { class: 'lc-kind-grid' }, [any, ...rows.values()]),
      back('town-back', showGrow),
    ]);
    panel.replaceChildren(screen);
    if (where === 'here') {
      const can = actions.townKindsHere((kind, ok) => {
        if (panel.contains(screen)) mark(kind, ok);
      });
      for (const kind of CHARACTERS) mark(kind, can[kind]);
    }
  };

  /** New island, second screen: what kind of island (saying the town there is now will be gone). */
  const showIslandKinds = (): void => {
    panel.replaceChildren(
      el('div', { class: 'lc-confirm lc-choice lc-kinds', attrs: { 'data-ui': 'confirm' } }, [
        el('p', { text: 'What kind of island?' }),
        losing(),
        kindItem('new-yes', 'dice', 'Surprise me', (signal) => actions.newIsland(null, signal)),
        ...ISLAND_KINDS.map((kind) => kindItem(`island-${kind}`, `isle-${kind}`, ISLAND_KIND_NAMES[kind], (signal) => actions.newIsland(kind, signal))),
        back('new-back', showItems),
      ]),
    );
  };

  const api: Menu = {
    button,
    el: panel,
    file,
    get isOpen() {
      return !panel.hasAttribute('hidden');
    },
    open() {
      showItems();
      panel.removeAttribute('hidden');
      button.setAttribute('aria-expanded', 'true');
    },
    close() {
      callOff();
      panel.setAttribute('hidden', '');
      button.setAttribute('aria-expanded', 'false');
    },
  };
  button.addEventListener('click', () => (api.isOpen ? api.close() : api.open()));
  return api;
}
