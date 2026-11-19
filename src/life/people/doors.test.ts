// Doors that open (L36), stepped with fixed time steps: the door table on its
// own, then a crowd walking a whole town in and out of its doors with the
// leaves where the table says they are. Nobody may stand where a leaf is,
// and a door nobody is near is shut.

import { describe, expect, test } from 'vitest';
import { DIR4, keyX, keyZ } from '@/core/grid';
import { faceFrame } from '@/gen/frames';
import { hingesOf, leafLine, type LeafKind } from '@/parts/openings/door-leaf';
import type { NavDoor } from '@/resolve/plan';
import { DOORS } from '@/style/animation';
import { HOUSE } from '@/style/houses';
import everything from '../../../scenarios/core/everything.scenario';
import peopleTown from '../../../scenarios/people/people-town.scenario';
import { easeInOut } from '../motion/ease';
import { createCrowd } from './crowd';
import { createDoors } from './doors';
import { clock, scenarioTown, watch, type TestTown } from './testing';

const STEP = 1 / 30;

describe('the door table', () => {
  test('a door nobody claims stays shut; a claim opens it in openTime, and it shuts after linger + shutTime', () => {
    const d = createDoors();
    d.step(STEP); // not settling any more
    d.claim('a');
    expect(d.ready('a')).toBe(false);
    let t = 0;
    while (!d.ready('a') && t < 5) {
      d.claim('a');
      d.step(STEP);
      t += STEP;
    }
    expect(t).toBeCloseTo(DOORS.openTime, 1);
    t = 0;
    while (d.open('a') > 0 && t < 5) {
      d.step(STEP);
      t += STEP;
    }
    expect(t).toBeCloseTo(DOORS.linger + DOORS.shutTime, 1);
    expect(d.open('b')).toBe(0);
  });

  test('two people in quick succession hold it open between them', () => {
    const d = createDoors();
    d.step(STEP);
    let least = 1;
    for (let i = 0; i < 120; i++) {
      // Two claims 1.2 s apart, each lasting 0.6 s.
      const s = i * STEP;
      if (s < 0.6 || (s > 1.2 && s < 1.8)) d.claim('a');
      d.step(STEP);
      if (s > 0.6 && s < 1.8) least = Math.min(least, d.open('a'));
    }
    expect(least).toBe(1);
  });

  test('a town just opened finds its doors as they should be: claimed ones open, shops open by day', () => {
    const d = createDoors();
    d.claim('a');
    d.stand('shop', true, 9);
    expect(d.open('a')).toBe(1);
    expect(d.open('shop')).toBe(1);
    d.step(STEP);
    // After that a shop follows the day only after its own delay.
    d.stand('shop', false, 2);
    for (let i = 0; i < 30; i++) d.step(STEP);
    expect(d.open('shop')).toBe(1);
    for (let i = 0; i < 90; i++) d.step(STEP);
    expect(d.open('shop')).toBe(0);
  });
});

/** Where a door's leaves are now, in world x–z: segments from hinge to free end. */
function leavesOf(town: TestTown, door: NavDoor, open: number): [number, number, number, number][] {
  if (door.dir === undefined) return [];
  const f = town.shape.features.find((x) => x.id === door.feature);
  const s = town.shape.structures.get(door.structure)!;
  const kind: LeafKind = s.kind === 'tower' || s.kind === 'lighthouse' ? 'tower' : ((f?.variant ?? 'plain') as LeafKind);
  // The wall plane: a house's wall stands HOUSE.inset in from the cell line.
  const m = faceFrame(door.cell, door.dir);
  const inset = s.kind === 'house' ? HOUSE.inset : 0;
  return hingesOf(kind).map((h) => {
    const [x0, z0, x1, z1] = leafLine(h, easeInOut(open) * h.swing);
    const w = (x: number, z: number): [number, number] => [m[12]! + m[0]! * x + m[8]! * (z - inset), m[14]! + m[2]! * x + m[10]! * (z - inset)];
    return [...w(x0, z0), ...w(x1, z1)] as [number, number, number, number];
  });
}

function distToSegment(px: number, pz: number, [ax, az, bx, bz]: [number, number, number, number]): number {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

function walkThrough(town: TestTown, seconds: number): { problems: string[]; throughDoors: number; shutChecks: number } {
  const c = clock(town.world.seed, 'day');
  const crowd = createCrowd();
  crowd.sync(town.shape, town.dressing, c.time);
  const w = watch(crowd);
  const problems: string[] = [];
  const doors = town.nav.doors.filter((d) => d.dir !== undefined);
  let throughDoors = 0, shutChecks = 0;
  const shops = new Set(town.shape.features.filter((f) => f.type === 'door' && f.variant === 'shop').map((f) => f.id));
  for (let i = 0; i < seconds * 30; i++) {
    crowd.step(c.tick(STEP), c.time);
    w.check();
    for (const p of crowd.people) {
      if (p.mode === 'walk' && p.walk?.[p.at]?.kind === 'door') throughDoors++;
    }
    for (const door of doors) {
      const open = crowd.doors.open(door.feature);
      const leaves = leavesOf(town, door, open);
      for (const p of crowd.people) {
        if (!p.visible) continue;
        // A person is about 0.14 across: nobody's middle within 0.06 of a leaf, wherever it is.
        for (const l of leaves) {
          const d = distToSegment(p.x, p.z, l);
          if (d < 0.06 && problems.length < 10) problems.push(`${p.id} (${p.mode}) at ${p.x.toFixed(2)},${p.z.toFixed(2)} is in the leaf of ${door.feature} (open ${open.toFixed(2)})`);
        }
      }
      // A door with nobody near (and not a shop by day) is shut.
      if (open > 0 && !(shops.has(door.feature) && c.time.isDay)) {
        const [dx, dz] = DIR4[door.dir!]!;
        const tx = keyX(door.cell) + 0.5 + dx * 0.5, tz = keyZ(door.cell) + 0.5 + dz * 0.5;
        shutChecks++;
        const near = crowd.people.some((p) => p.mode !== 'gone' && Math.hypot(p.x - tx, p.z - tz) < 2.6);
        if (!near && problems.length < 10) problems.push(`${door.feature} is open ${open.toFixed(2)} with nobody near`);
      }
    }
  }
  return { problems: [...problems, ...w.problems], throughDoors, shutChecks };
}

describe('people and doors (L36)', () => {
  test('every door of the everything town has a leaf, and every derived hatch a lid (L36)', () => {
    const town = scenarioTown(everything);
    const leaves = new Set(town.dressing.actors.filter((a) => a.type === 'door-leaf').map((a) => (a.at && 'socket' in a.at ? a.at.socket : a.at && 'cell' in a.at ? `hatch@${a.at.cell}` : '')));
    const doors = town.shape.features.filter((f) => f.type === 'door');
    expect(doors.length).toBeGreaterThan(20);
    for (const f of doors) expect(leaves.has(`${f.id}/door`), f.id).toBe(true);
    for (const d of town.nav.doors) if (d.feature.startsWith('hatch@')) expect(leaves.has(d.feature), d.feature).toBe(true);
  });

  test('in the people town nobody walks through a leaf, open or shut, and doors nobody is near are shut', () => {
    const r = walkThrough(scenarioTown(peopleTown), 150);
    expect(r.problems).toEqual([]);
    expect(r.throughDoors).toBeGreaterThan(200);
  });

  test('the same in the everything town (shops, a chapel, towers, a lighthouse)', () => {
    const r = walkThrough(scenarioTown(everything), 90);
    expect(r.problems).toEqual([]);
    expect(r.throughDoors).toBeGreaterThan(100);
  });

  test('a door somebody steps through is fully open while they are in the doorway', () => {
    const town = scenarioTown(peopleTown);
    const c = clock(town.world.seed, 'day');
    const crowd = createCrowd();
    crowd.sync(town.shape, town.dressing, c.time);
    let seen = 0;
    for (let i = 0; i < 60 * 30; i++) {
      crowd.step(c.tick(STEP), c.time);
      for (const p of crowd.people) {
        const piece = p.mode === 'walk' ? p.walk?.[p.at] : undefined;
        if (piece?.kind !== 'door' || !piece.door || p.t === 0) continue;
        seen++;
        expect(crowd.doors.open(piece.door.feature), `${p.id} in ${piece.door.feature}`).toBe(1);
      }
    }
    expect(seen).toBeGreaterThan(100);
  });
});
