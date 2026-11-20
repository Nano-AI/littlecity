// The ☰ menu (design section 7): grow a town (design 15a; it opens a second
// screen that asks where: on this island or on a new one), new island (with
// a confirm), share link, postcard, town file out and in, and sound. (The dev
// tuning panel is not in the game: removed at Derek's request, 2026-11-20.
// It lives on in the gallery.)
// Owner: Interface.

import { el, iconButton, setIcon } from './dom';

export interface MenuActions {
  /** Fills this island with a grown town. */
  growTown(): void;
  /** Grows a different town on a new island. */
  growNewIsland(): void;
  /** The island holds more than its starting trees: growing over it (or leaving it) asks first. */
  hasTown(): boolean;
  newIsland(): void;
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
      item('new', 'island', 'New island', showConfirm, true),
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
    panel.replaceChildren(
      el('div', { class: 'lc-confirm lc-choice', attrs: { 'data-ui': 'grow-choice' } }, [
        el('p', { text: 'Grow a town' }),
        item('grow-here', 'grow', 'On this island', actions.growTown),
        item('grow-new', 'island', 'On a new island', actions.growNewIsland),
        el('div', { class: 'lc-confirm-buttons' }, [el('button', { class: 'lc-text-btn', text: 'Back', attrs: { type: 'button', 'data-menu': 'grow-back' }, on: { click: showItems } })]),
      ]),
    );
  };

  const showConfirm = (): void => {
    panel.replaceChildren(
      el('div', { class: 'lc-confirm', attrs: { 'data-ui': 'confirm' } }, [
        el('p', { text: 'Start a new island?' }),
        el('small', { text: 'The town you have now will be gone.' }),
        el('div', { class: 'lc-confirm-buttons' }, [
          el('button', {
            class: 'lc-text-btn lc-primary',
            text: 'New island',
            attrs: { type: 'button', 'data-menu': 'new-yes' },
            on: {
              click: () => {
                api.close();
                actions.newIsland();
              },
            },
          }),
          el('button', { class: 'lc-text-btn', text: 'Keep this one', attrs: { type: 'button', 'data-menu': 'new-no' }, on: { click: () => api.close() } }),
        ]),
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
      panel.setAttribute('hidden', '');
      button.setAttribute('aria-expanded', 'false');
    },
  };
  button.addEventListener('click', () => (api.isOpen ? api.close() : api.open()));
  return api;
}
