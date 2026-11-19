// The ✨ on every Auto block while the Change tool is selected, so the
// player can tell Auto from fixed (design section 7; catalogue F07).
// Owner: Interface.
//
// The markers are a layer of small pictures over the canvas, placed with
// TownView.worldToScreen. A block hidden behind something else gets none:
// the same pick the pointer uses says whether the block is the first thing
// in line. Positions are worked out again only when the town, the camera or
// the canvas size changes.

import { CELL_H, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import type { Terrain, World } from '@/core/world';
import type { TownView } from '@/render/api';
import { INPUT } from '@/style/input';
import { el } from './dom';
import { icon } from './icons';
import { pickCell } from './pick';

export interface Markers {
  readonly el: HTMLElement;
  /** Call once per frame. `on` is whether the Change tool is selected. */
  update(on: boolean, world: World, terrain: Terrain): void;
  /** The cells that have a marker right now (for tests). */
  cells(): CellKey[];
}

export function createMarkers(view: TownView): Markers {
  const layer = el('div', { class: 'lc-markers', attrs: { 'aria-hidden': 'true' } });
  const pool: HTMLElement[] = [];
  let shown: CellKey[] = [];
  let signature = '';
  let lastWorld: World | null = null;

  const place = (world: World, terrain: Terrain): void => {
    const w = view.canvas.clientWidth, h = view.canvas.clientHeight;
    const found: { cell: CellKey; x: number; y: number; d: number }[] = [];
    for (const [cell, block] of world.blocks) {
      if (block.kind !== 'auto') continue;
      const [x, y] = view.worldToScreen([keyX(cell) + 0.5, (keyY(cell) + 0.5) * CELL_H, keyZ(cell) + 0.5]);
      if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue;
      found.push({ cell, x, y, d: Math.hypot(x - w / 2, y - h / 2) });
    }
    // Too many to draw: keep the ones nearest the middle of the view.
    if (found.length > INPUT.maxMarkers) found.sort((a, b) => a.d - b.d);
    const visible = found.slice(0, INPUT.maxMarkers).filter((m) => pickCell(view.screenToRay(m.x, m.y), world, terrain)?.cell === m.cell);

    while (pool.length < visible.length) {
      const node = el('div', { class: 'lc-marker', html: icon('sparkle') });
      node.style.setProperty('--d', `${-((pool.length * 0.37) % 1.7).toFixed(2)}s`);
      pool.push(node);
      layer.append(node);
    }
    pool.forEach((node, i) => {
      const m = visible[i];
      node.hidden = !m;
      if (m) node.style.transform = `translate(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px)`;
    });
    shown = visible.map((m) => m.cell);
  };

  return {
    el: layer,
    update(on, world, terrain) {
      if (!on) {
        if (signature !== '') {
          signature = '';
          shown = [];
          for (const node of pool) node.hidden = true;
        }
        return;
      }
      const c = view.getCamera();
      const next = `${world.nextSeq}:${world.blocks.size}:${c.yaw}:${c.pitch}:${c.zoom}:${c.target.join(',')}:${view.canvas.clientWidth}x${view.canvas.clientHeight}`;
      if (next === signature && lastWorld === world) return;
      signature = next;
      lastWorld = world;
      place(world, terrain);
    },
    cells: () => [...shown],
  };
}
