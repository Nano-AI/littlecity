// The Mischief drawer's tools, in use (design section 13b). Owner: Mischief.
//
//   Torch   click a building: it catches fire
//   Bomb    click anywhere: a bomb drops there, fizzes, and goes off
//   Mallet  click a building: it is knocked a stage worse (cracked, half, rubble)
//   Mend    click a damaged building: scaffolding goes up, then it is mended a
//           stage a click; Shift-click mends it at once
//
// Nothing destructive happens by surprise: only these clicks start anything,
// the drawer looks different from the others (a red, dashed tab), and the
// first use of each tool says, once, that undo puts it all back. A drawn
// "BOOM!" pops over a blast, in the page (it always faces the reader).

import { CELL_H, keyY, type CellKey } from '@/core/grid';
import type { Game } from '@/app/game';
import type { Director, MischiefEvent } from '@/life/mischief/director';
import type { TownView } from '@/render/api';
import { PALETTE } from '@/style/palette';
import type { Feedback } from './feedback';
import type { Pick } from './pick';
import { el } from './dom';
import { icon } from './icons';
import type { MischiefToolId } from './pieces';

/** The field guide's Mischief group: what each tool does, in a sentence (no recipe town: nothing here is built). */
export const MISCHIEF_GUIDE: readonly { tool: MischiefToolId; name: string; how: string }[] = [
  { tool: 'torch', name: 'Torch', how: 'Click a building to set it alight. Timber and thatch burn fast and the wind carries the fire along a row; a street, a wall or water stops it, and stone only scorches.' },
  { tool: 'bomb', name: 'Bomb', how: 'Click anywhere: a bomb drops, fizzes and goes BOOM. What is right beside it falls to rubble, what is near loses its glass, and every bird takes off. In the sea it only splashes.' },
  { tool: 'nuke', name: 'Nuke', how: 'The big one: a siren, a long whistle, a flash, a mushroom cloud. Everything for streets around is flattened, fires start at the edge, and a crater is left in the ground. One undo puts even the ground back.' },
  { tool: 'mallet', name: 'Mallet', how: 'Click a building to knock it a stage worse: cracked, then half-wrecked, then a heap of its own bricks.' },
  { tool: 'mend', name: 'Mend', how: 'Click something damaged: scaffolding goes up, and each click mends a stage until it is exactly as you built it. Shift-click mends it at once.' },
];

export function mischiefGuideSection(): HTMLElement {
  const list = el('ul', { class: 'lc-guide-list' });
  for (const m of MISCHIEF_GUIDE) {
    list.append(
      el('li', { class: 'lc-guide-entry', attrs: { 'data-mischief': m.tool } }, [
        el('div', { class: 'lc-guide-picture lc-guide-mischief-icon', html: icon(m.tool) }),
        el('div', { class: 'lc-guide-words' }, [el('h4', {}, [el('span', { text: m.name })]), el('p', { text: m.how })]),
      ]),
    );
  }
  return el('section', { class: 'lc-guide-group lc-guide-mischief', attrs: { 'data-group': 'mischief' } }, [
    el('h3', {}, [el('span', { text: 'Mischief' })]),
    el('p', { class: 'lc-guide-note', text: 'Only your clicks start anything, and undo puts it all back.' }),
    list,
  ]);
}

const HINTS_KEY = 'little-city.mischief-hints';

const CSS = `
.lc-tab[data-drawer='mischief'] {
  border-style: dashed;
  border-color: ${PALETTE.redDark};
  color: ${PALETTE.redDark};
  background: color-mix(in srgb, ${PALETTE.red} 14%, var(--lc-paper));
  margin-left: 8px;
}
.lc-tab[data-drawer='mischief'][aria-selected='true'] {
  background: color-mix(in srgb, ${PALETTE.red} 10%, var(--lc-card));
  border-bottom-color: color-mix(in srgb, ${PALETTE.red} 10%, var(--lc-card));
}
.lc-tray:has(.lc-tab[data-drawer='mischief'][aria-selected='true']) .lc-tray-card {
  background: color-mix(in srgb, ${PALETTE.red} 10%, var(--lc-card));
  border-color: ${PALETTE.redDark};
  border-style: dashed;
}
.lc-boom {
  position: fixed;
  left: 0;
  top: 0;
  pointer-events: none;
  z-index: 40;
  transform-origin: 50% 60%;
  animation: lc-boom 1.1s ease-out forwards;
}
.lc-guide-mischief-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, ${PALETTE.red} 10%, var(--lc-card));
}
.lc-guide-mischief-icon .lc-icon { width: 60%; height: 60%; }
.lc-whiteout {
  position: fixed;
  inset: 0;
  background: #fffdf4;
  pointer-events: none;
  z-index: 45;
  animation: lc-whiteout 0.7s ease-out forwards;
}
@keyframes lc-whiteout {
  0% { opacity: 0; }
  8% { opacity: 1; }
  30% { opacity: 0.9; }
  100% { opacity: 0; }
}
@keyframes lc-boom {
  0% { opacity: 0; scale: 0.2; }
  12% { opacity: 1; scale: 1.15; }
  22% { scale: 0.95; }
  30% { scale: 1.02; }
  75% { opacity: 1; translate: 0 -10px; }
  100% { opacity: 0; translate: 0 -26px; scale: 1.05; }
}
`;

function boomSvg(word: string, seed: number): string {
  // A jagged burst, a little different each time, with the word lettered over it.
  const pts: string[] = [];
  const n = 13;
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + seed * 0.37;
    const r = i % 2 === 0 ? 74 + ((i * 37 + seed * 11) % 17) : 50 + ((i * 13 + seed * 7) % 9);
    pts.push(`${(100 + Math.cos(a) * r * 1.15).toFixed(1)},${(80 + Math.sin(a) * r * 0.8).toFixed(1)}`);
  }
  const inner = pts.map((p) => {
    const [x, y] = p.split(',').map(Number);
    return `${(100 + (x! - 100) * 0.72).toFixed(1)},${(80 + (y! - 80) * 0.72).toFixed(1)}`;
  });
  return (
    `<svg width="200" height="160" viewBox="0 0 200 160" aria-hidden="true">` +
    `<g filter="url(#lc-wobble)" stroke="${PALETTE.ink}" stroke-width="3" stroke-linejoin="round">` +
    `<polygon points="${pts.join(' ')}" fill="${PALETTE.red}"/>` +
    `<polygon points="${inner.join(' ')}" fill="${PALETTE.yellow}" stroke-width="2"/>` +
    `<text x="100" y="94" text-anchor="middle" font-family="'Comic Sans MS','Chalkboard SE','Marker Felt',system-ui,sans-serif" ` +
    `font-weight="900" font-size="44" fill="${PALETTE.white}" stroke="${PALETTE.ink}" stroke-width="3" paint-order="stroke" ` +
    `transform="rotate(${-6 + (seed % 5) * 2} 100 80)">${word}</text>` +
    `</g></svg>`
  );
}

export interface MischiefTools {
  /** A click with a mischief tool. True if it did something. */
  use(tool: MischiefToolId, pick: Pick | null, opts: { shift: boolean }): boolean;
  /** Undo pressed: while something is going on, it is all called off. True if it was. */
  undo(): boolean;
  /** An act of mischief is going on (undo cancels it). */
  readonly active: boolean;
  dispose(): void;
}

export function createMischiefTools(host: {
  view: TownView;
  game: Game;
  feedback: Feedback;
  director: Director;
  root: HTMLElement;
  /** Why not, at the pointer. */
  refuse(reason: string): void;
}): MischiefTools {
  const { view, director, feedback } = host;
  if (!document.getElementById('lc-mischief-style')) {
    const style = document.createElement('style');
    style.id = 'lc-mischief-style';
    style.textContent = CSS;
    document.head.append(style);
  }
  let hinted: Record<string, boolean> = {};
  try {
    hinted = JSON.parse(localStorage.getItem(HINTS_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    hinted = {};
  }
  const hint = (tool: MischiefToolId): void => {
    if (hinted[tool]) return;
    hinted[tool] = true;
    try {
      localStorage.setItem(HINTS_KEY, JSON.stringify(hinted));
    } catch {
      // No storage: the hint shows once a session.
    }
    feedback.toast(tool === 'mend' ? 'Mending a stage at a time; Shift-click mends it at once.' : 'Undo puts it all back.');
  };

  let booms = 0;
  const boom = (point: readonly [number, number, number], word: string): void => {
    const [sx, sy] = view.worldToScreen([point[0], point[1] + 0.6, point[2]]);
    const r = view.canvas.getBoundingClientRect();
    const node = document.createElement('div');
    node.className = 'lc-boom';
    node.innerHTML = boomSvg(word, ++booms);
    node.style.left = `${Math.round(r.left + sx - 100)}px`;
    node.style.top = `${Math.round(r.top + sy - 110)}px`;
    node.addEventListener('animationend', () => node.remove());
    host.root.append(node);
  };
  /** A nuke whites the page out for an instant. */
  const whiteout = (): void => {
    const node = document.createElement('div');
    node.className = 'lc-whiteout';
    node.addEventListener('animationend', () => node.remove());
    host.root.append(node);
  };
  const off = director.on((e: MischiefEvent) => {
    if (e.type !== 'blast') return;
    if (e.nuke && !e.blast.water) {
      whiteout();
      boom(e.blast.point, 'KA-BOOM!');
    } else boom(e.blast.point, e.blast.water ? 'SPLOOSH!' : 'BOOM!');
  });

  const blockOf = (pick: Pick | null): CellKey | null => (pick && pick.hit === 'block' ? pick.cell : null);

  return {
    use(tool, pick, { shift }) {
      if (tool === 'bomb' || tool === 'nuke') {
        if (!pick) return false;
        // On whatever was clicked: a roof, the ground, the sea.
        const p = pick.point;
        const y = pick.hit === 'water' ? p[1] : pick.hit === 'block' && pick.normal[1] > 0 ? (keyY(pick.cell) + 1) * CELL_H : p[1];
        if (tool === 'nuke') director.dropNuke([p[0], y, p[2]]);
        else director.dropBomb([p[0], y, p[2]]);
        hint(tool);
        return true;
      }
      const cell = blockOf(pick);
      if (cell === null) {
        host.refuse(tool === 'mend' ? 'click something that needs mending' : 'click a building');
        return false;
      }
      let ok: boolean;
      if (tool === 'torch') {
        ok = director.ignite(cell);
        if (!ok) host.refuse("that won't catch");
      } else if (tool === 'mallet') {
        ok = director.knock(cell);
        if (!ok) host.refuse('there is nothing left to knock down');
      } else {
        ok = director.mend(cell, shift);
        if (!ok) host.refuse('that is not damaged');
      }
      if (ok) hint(tool);
      return ok;
    },
    undo() {
      if (!director.active) return false;
      director.cancel();
      return true;
    },
    get active() {
      return director.active;
    },
    dispose() {
      off();
    },
  };
}
