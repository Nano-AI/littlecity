// Sliders bound to the style modules (src/style/*.ts), for the gallery and
// for the app's dev tuning panel. Owner: Interface.
//
// Every value of every registered style module gets a control: a slider
// where the module declared a range, a number box where it did not, a colour
// well for '#rrggbb' strings (and one per entry for arrays of them), a tick
// box for booleans. Changing one calls setStyle(), which bumps
// styleVersion(); the caller's onChange then re-resolves and redraws.

import { allStyles, resetStyles, setStyle, type StyleModule, type StyleValue } from '@/core/style';
import { el } from './dom';

// Style modules register themselves when imported; load them all so the list is complete.
import.meta.glob('/src/style/*.ts', { eager: true });

const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const same = (a: StyleValue, b: StyleValue): boolean => (Array.isArray(a) && Array.isArray(b) ? a.join() === b.join() : a === b);

function format(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return Math.abs(n) < 0.01 ? n.toPrecision(2) : String(Number(n.toFixed(4)));
}

/** The values that differ from their defaults, as { module: { key: value } }: paste them into the style files. */
export function changedStyles(): Record<string, Record<string, StyleValue>> {
  const out: Record<string, Record<string, StyleValue>> = {};
  for (const mod of allStyles()) {
    for (const key of Object.keys(mod.values)) {
      if (same(mod.values[key]!, mod.defaults[key]!)) continue;
      (out[mod.name] ??= {})[key] = mod.values[key]!;
    }
  }
  return out;
}

export interface Sliders {
  readonly el: HTMLElement;
  /** Re-reads every value (after resetStyles, or a change made elsewhere). */
  refresh(): void;
}

/** One collapsible group per style module. `open` names the modules that start open. */
export function createSliders(onChange: () => void, open: readonly string[] = []): Sliders {
  const root = el('div', { class: 'lc-sliders', attrs: { 'data-ui': 'sliders' } });

  const control = (mod: StyleModule, key: string): HTMLElement => {
    const value = mod.values[key]!;
    const row = el('label', { class: 'lc-slider', attrs: { 'data-style': `${mod.name}.${key}` } }, [el('span', { text: key, title: `${mod.name}.${key}` })]);
    const mark = (): void => {
      row.classList.toggle('lc-changed', !same(mod.values[key]!, mod.defaults[key]!));
    };
    const set = (next: StyleValue): void => {
      setStyle(mod.name, key, next);
      mark();
      onChange();
    };

    if (typeof value === 'number') {
      const range = mod.ranges[key];
      const out = el('output', { text: format(value) });
      if (range) {
        const [min, max, step] = range;
        const input = el('input', {
          attrs: { type: 'range', min: String(min), max: String(max), step: String(step ?? (max - min) / 100), value: String(value) },
        });
        input.addEventListener('input', () => {
          out.textContent = format(input.valueAsNumber);
          set(input.valueAsNumber);
        });
        row.append(input, out);
      } else {
        const input = el('input', { attrs: { type: 'number', step: 'any', value: String(value) } });
        input.addEventListener('input', () => {
          if (Number.isFinite(input.valueAsNumber)) set(input.valueAsNumber);
        });
        row.append(input, el('span'));
      }
    } else if (typeof value === 'boolean') {
      const input = el('input', { attrs: { type: 'checkbox' } });
      input.checked = value;
      input.addEventListener('change', () => set(input.checked));
      row.append(input, el('span'));
    } else if (isColor(value)) {
      const input = el('input', { attrs: { type: 'color', value } });
      input.addEventListener('input', () => set(input.value));
      row.append(input, el('output', { text: '' }));
    } else if (Array.isArray(value)) {
      const list = el('span', { class: 'lc-colors' });
      value.forEach((entry: number | string, i: number) => {
        const color = isColor(entry);
        const input = el('input', { attrs: { type: color ? 'color' : typeof entry === 'number' ? 'number' : 'text', value: String(entry), step: 'any' } });
        input.addEventListener('input', () => {
          const next = [...(mod.values[key] as readonly (number | string)[])];
          next[i] = typeof entry === 'number' ? input.valueAsNumber : input.value;
          set(next as StyleValue);
        });
        list.append(input);
      });
      row.append(list);
    } else {
      const input = el('input', { attrs: { type: 'text', value: String(value) } });
      input.addEventListener('change', () => set(input.value));
      row.append(input, el('span'));
    }
    mark();
    return row;
  };

  const build = (): void => {
    const wasOpen = new Set([...root.querySelectorAll<HTMLDetailsElement>('details[open]')].map((d) => d.dataset.module!));
    const first = root.childElementCount === 0;
    root.replaceChildren(
      ...allStyles().map((mod) => {
        const group = el('details', { attrs: { 'data-module': mod.name } }, [el('summary', { text: mod.name })]);
        group.open = first ? open.includes(mod.name) : wasOpen.has(mod.name);
        for (const key of Object.keys(mod.values)) group.append(control(mod, key));
        return group;
      }),
    );
  };
  build();
  return { el: root, refresh: build };
}

/** The whole panel: a heading, reset and copy buttons, and the sliders. */
export function createTuningPanel(onChange: () => void, opts: { title?: string; open?: readonly string[]; onClose?: () => void } = {}): HTMLElement {
  const sliders = createSliders(onChange, opts.open);
  const button = (text: string, title: string, run: () => void): HTMLElement =>
    el('button', { class: 'lc-text-btn', text, title, attrs: { type: 'button', style: 'min-height:28px;padding:3px 10px;font-size:12px' }, on: { click: run } });
  const copy = button('Copy', 'Copy the changed values as JSON, to paste into the style files', () => {
    const json = JSON.stringify(changedStyles(), null, 2);
    void navigator.clipboard?.writeText(json).catch(() => {});
    copy.textContent = 'Copied';
    setTimeout(() => (copy.textContent = 'Copy'), 1200);
  });
  const head = el('div', { class: 'lc-tuning-head' }, [
    el('span', { text: opts.title ?? 'Tuning' }),
    copy,
    button('Reset', 'Put every value back', () => {
      resetStyles();
      sliders.refresh();
      onChange();
    }),
    opts.onClose ? button('Close', 'Close', opts.onClose) : null,
  ]);
  return el('div', { class: 'lc-card lc-tuning', attrs: { 'data-ui': 'tuning' } }, [head, sliders.el]);
}
