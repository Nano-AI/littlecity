// STUB (Stage 0, working). Owner: Interface (Stage 1).
//
// The smallest input that proves the loop: click places the selected kind,
// right click erases, left drag orbits, right drag pans, wheel zooms, keys
// 1–9 pick a kind. The Interface owner replaces this with the tray, tools,
// ghost, touch gestures and the rest of design section 7.

import { NO_CELL } from '@/core/grid';
import type { PlacedKind } from '@/core/kinds';
import type { Edit, Terrain, World } from '@/core/world';
import type { TownView } from '@/render/api';
import { pickCell } from './pick';

export const STUB_KINDS: readonly PlacedKind[] = ['auto', 'house', 'tower', 'marble', 'pillar', 'arch', 'tree', 'fence', 'wall'];

export interface InputHost {
  view: TownView;
  world(): World;
  terrain(): Terrain;
  /** Apply an edit if it is legal; returns whether it was. */
  edit(e: Edit): boolean;
  onKind?(kind: PlacedKind): void;
}

const CLICK_SLOP = 5;

export function attachInput(host: InputHost): () => void {
  const canvas = host.view.canvas;
  let kind: PlacedKind = 'auto';
  let down: { x: number; y: number; button: number; moved: boolean } | null = null;

  const local = (e: MouseEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const act = (e: PointerEvent, erase: boolean): void => {
    const [x, y] = local(e);
    const pick = pickCell(host.view.screenToRay(x, y), host.world(), host.terrain());
    if (!pick) return;
    if (erase) {
      if (pick.hit === 'block') host.edit({ type: 'eraseBlock', cell: pick.cell });
      return;
    }
    if (pick.target === NO_CELL) return;
    host.edit({ type: 'placeBlock', cell: pick.target, kind, color: 'auto', from: pick.from });
  };

  const onDown = (e: PointerEvent): void => {
    down = { x: e.clientX, y: e.clientY, button: e.button, moved: false };
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent): void => {
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (!down.moved && Math.hypot(dx, dy) <= CLICK_SLOP) return;
    down.moved = true;
    if (down.button === 0) host.view.orbit(-e.movementX * 0.4, e.movementY * 0.3);
    else host.view.pan(e.movementX, e.movementY);
  };
  const onUp = (e: PointerEvent): void => {
    if (down && !down.moved) act(e, down.button === 2);
    down = null;
  };
  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    host.view.zoomBy(Math.exp(-e.deltaY * 0.0015));
  };
  const onKey = (e: KeyboardEvent): void => {
    const n = Number.parseInt(e.key, 10);
    if (n >= 1 && n <= STUB_KINDS.length) {
      kind = STUB_KINDS[n - 1]!;
      host.onKind?.(kind);
    }
  };
  const noMenu = (e: Event): void => e.preventDefault();

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', noMenu);
  window.addEventListener('keydown', onKey);
  host.onKind?.(kind);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', noMenu);
    window.removeEventListener('keydown', onKey);
  };
}
