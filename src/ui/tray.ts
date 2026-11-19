// The tray (design section 7): the pieces and tools, in drawers, with the
// colour swatch beside them. On a phone the open drawer is one row that
// scrolls sideways. Owner: Interface.

import { PALETTE_SIZE, placedInfo, type PlacedKind } from '@/core/kinds';
import { RAMPS } from '@/style/palette';
import { el, iconButton } from './dom';
import { icon } from './icons';
import { DRAWER_IDS, DRAWER_LABELS, drawerItems, drawerOf, isFloorPiece, isToolId, type DrawerId, type ItemId } from './pieces';

export interface TrayState {
  /** The drawer that is open. */
  drawer: DrawerId;
  /** The selected piece or tool. It stays selected while another drawer is open. */
  item: ItemId;
  /** 'auto' (the default): a new block takes the colour of what it was placed on. */
  swatch: number | 'auto';
}

export interface Tray {
  readonly el: HTMLElement;
  readonly state: Readonly<TrayState>;
  /** Selects a piece or tool and opens its drawer. */
  select(item: ItemId): void;
  openDrawer(drawer: DrawerId): void;
  setSwatch(swatch: number | 'auto'): void;
  /** Keys 1–9 and 0: the nth item of the open drawer (0 is the tenth). False if there is none. */
  pickNumber(n: number): boolean;
  /** Refusal feedback: the selected button shakes its head. */
  shake(): void;
  closePopups(): void;
  onChange(fn: (state: Readonly<TrayState>) => void): void;
}

/** The colours the swatch offers for the selected piece: each kind maps the index onto its own ramp. */
export function swatchColors(item: ItemId): readonly string[] {
  const ramp = isToolId(item) || isFloorPiece(item) ? 'wall' : placedInfo(item as PlacedKind).ramp;
  return RAMPS[ramp === 'none' ? 'wall' : ramp];
}

export function createTray(start: Partial<TrayState> = {}): Tray {
  const state: TrayState = { drawer: 'build', item: 'auto', swatch: 'auto', ...start };
  const listeners: ((s: Readonly<TrayState>) => void)[] = [];
  const emit = (): void => listeners.forEach((fn) => fn(state));

  const tabs = el('div', { class: 'lc-tabs', attrs: { role: 'tablist', 'aria-label': 'Drawers' } });
  const row = el('div', { class: 'lc-row', attrs: { role: 'group' } });
  const swatchButton = el('button', {
    class: 'lc-btn lc-swatch-btn',
    attrs: { type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'data-ui': 'swatch' },
  });
  const swatches = el('div', { class: 'lc-pop lc-swatches', attrs: { role: 'group', 'aria-label': 'Colour', hidden: '' } });
  const card = el('div', { class: 'lc-card lc-tray-card' }, [row, el('div', { class: 'lc-tray-side' }, [swatchButton])]);
  const root = el('div', { class: 'lc-tray', attrs: { role: 'toolbar', 'aria-label': 'Pieces and tools' } }, [tabs, card, swatches]);

  const tabButtons = new Map<DrawerId, HTMLButtonElement>();
  for (const id of DRAWER_IDS) {
    const tab = el('button', {
      class: 'lc-tab',
      text: DRAWER_LABELS[id],
      attrs: { type: 'button', role: 'tab', 'data-drawer': id },
      on: { click: () => api.openDrawer(id) },
    });
    tabButtons.set(id, tab);
    tabs.append(tab);
  }

  const renderRow = (): void => {
    row.replaceChildren();
    drawerItems(state.drawer).forEach((item, index) => {
      const key = index < 9 ? String(index + 1) : index === 9 ? '0' : '';
      const button = iconButton(item.id, item.label, {
        class: 'lc-item',
        showLabel: true,
        title: key ? `${item.hint} (${key})` : item.hint,
        attrs: { 'data-item': item.id, 'aria-pressed': String(item.id === state.item) },
        on: { click: () => api.select(item.id) },
      });
      row.append(button);
    });
    row.scrollLeft = 0;
  };

  const renderSwatch = (): void => {
    const colors = swatchColors(state.item);
    const auto = state.swatch === 'auto';
    swatchButton.title = auto ? 'Colour: auto (matches what you build on)' : 'Colour';
    swatchButton.setAttribute('aria-label', auto ? 'Colour: auto' : `Colour ${Number(state.swatch) + 1}`);
    swatchButton.setAttribute('data-swatch', String(state.swatch));
    swatchButton.replaceChildren(
      auto
        ? el('span', { class: 'lc-btn-icon', html: icon('swatch-auto') })
        : el('span', { class: 'lc-dot', attrs: { style: `background:${colors[Number(state.swatch) % colors.length]}` } }),
      el('span', { class: 'lc-btn-label', text: 'Colour' }),
    );
    swatches.replaceChildren(
      el('button', {
        class: 'lc-swatch lc-swatch-auto',
        html: icon('swatch-auto'),
        title: 'Auto: match what you build on',
        attrs: { type: 'button', 'aria-label': 'Auto colour', 'aria-pressed': String(auto), 'data-swatch': 'auto' },
        on: { click: () => api.setSwatch('auto') },
      }),
      ...Array.from({ length: PALETTE_SIZE }, (_, i) =>
        el('button', {
          class: 'lc-swatch',
          attrs: {
            type: 'button',
            'aria-label': `Colour ${i + 1}`,
            'aria-pressed': String(state.swatch === i),
            'data-swatch': String(i),
            style: `--c:${colors[i % colors.length]}`,
          },
          on: { click: () => api.setSwatch(i) },
        }),
      ),
    );
  };

  const renderSelection = (): void => {
    for (const [id, tab] of tabButtons) {
      tab.setAttribute('aria-selected', String(id === state.drawer));
      tab.classList.toggle('lc-tab-holds', id === drawerOf(state.item) && id !== state.drawer);
    }
    for (const button of row.querySelectorAll<HTMLElement>('[data-item]')) {
      button.setAttribute('aria-pressed', String(button.dataset.item === state.item));
    }
    row.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  const setPopup = (open: boolean): void => {
    swatches.toggleAttribute('hidden', !open);
    swatchButton.setAttribute('aria-expanded', String(open));
  };
  swatchButton.addEventListener('click', () => setPopup(swatches.hasAttribute('hidden')));

  const api: Tray = {
    el: root,
    state,
    select(item) {
      const drawer = drawerOf(item);
      const drawerChanged = drawer !== state.drawer;
      state.item = item;
      state.drawer = drawer;
      if (drawerChanged) renderRow();
      renderSelection();
      renderSwatch();
      emit();
    },
    openDrawer(drawer) {
      if (drawer === state.drawer) return;
      state.drawer = drawer;
      renderRow();
      renderSelection();
      emit();
    },
    setSwatch(swatch) {
      state.swatch = swatch;
      renderSwatch();
      setPopup(false);
      emit();
    },
    pickNumber(n) {
      const items = drawerItems(state.drawer);
      const item = items[n === 0 ? 9 : n - 1];
      if (!item) return false;
      api.select(item.id);
      return true;
    },
    shake() {
      const target = row.querySelector<HTMLElement>('[aria-pressed="true"]') ?? tabButtons.get(drawerOf(state.item))!;
      target.classList.remove('lc-shake');
      void target.offsetWidth; // restart the animation
      target.classList.add('lc-shake');
    },
    closePopups: () => setPopup(false),
    onChange(fn) {
      listeners.push(fn);
    },
  };

  renderRow();
  renderSelection();
  renderSwatch();
  return api;
}
