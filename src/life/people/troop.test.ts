// The garrison (L36), stepped with fixed time steps on the everything town's
// castle: the troop keeps formation, never leaves the walking graph or walks
// into the castle, halts at the gate each lap, and goes in at night.

import { describe, expect, test } from 'vitest';
import { columnIndex, keyX, keyY, keyZ, CELL_H } from '@/core/grid';
import { findCastles } from '@/rules/life/castle.lib';
import { GARRISON } from '@/style/people';
import everything from '../../../scenarios/core/everything.scenario';
import garrisonTown from '../../../scenarios/rules/L36.garrison.scenario';
import riderTown from '../../../scenarios/rules/L37.rider.scenario';
import { clock, scenarioTown } from './testing';
import { createTroop, patrolOf } from './troop';

const town = scenarioTown(everything);
const castle = findCastles(town.shape, town.nav)[0]!;

describe('the garrison (L36)', () => {
  test('the everything town has a castle with a keep, walls and a gate; its patrol keeps outside the walls', () => {
    expect(castle.keep).not.toBeNull();
    expect(castle.troop).toBe(6);
    expect(castle.gate).not.toBeNull();
    const track = patrolOf(town.nav, castle)!;
    expect(track.length).toBeGreaterThan(8);
    for (let i = 0; i < track.x.length; i++) expect(castle.columns.has(columnIndex(Math.floor(track.x[i]!), Math.floor(track.z[i]!)))).toBe(false);
  });

  test('a day of marching: in step, in formation, on the graph, halting at the gate each pass', () => {
    const track = patrolOf(town.nav, castle)!;
    const c = clock(town.world.seed, 'day');
    const troop = createTroop(town.nav, castle, track, c.time);
    const problems: string[] = [];
    let halts = 0, was = troop.mode;
    for (let i = 0; i < 30 * 200; i++) {
      troop.step(c.tick(1 / 30), c.time);
      if (troop.mode === 'halt' && was !== 'halt' && troop.haltedAt === 'gate') {
        halts++;
        // The middle of the column is at the gate.
        const mid = troop.s + ((Math.ceil(castle.troop / 2) - 1) * GARRISON.spacing) / 2;
        const d = track.loop ? Math.abs(((mid - troop.gateAt + track.length * 1.5) % track.length) - track.length / 2) : Math.abs(mid - troop.gateAt);
        if (d > 0.1) problems.push(`halted ${d.toFixed(2)} from the gate`);
      }
      was = troop.mode;
      const strides = new Set<number>();
      for (const s of troop.soldiers) {
        const cell = town.nav.nodes[s.node]?.cell;
        if (cell === undefined || Math.floor(s.x) !== keyX(cell) || Math.floor(s.z) !== keyZ(cell)) {
          if (problems.length < 10) problems.push(`soldier ${s.index} at ${s.x.toFixed(2)},${s.z.toFixed(2)} is off its cell`);
          continue;
        }
        if (Math.abs(s.y - keyY(cell) * CELL_H) > CELL_H + 0.05 && problems.length < 10) problems.push(`soldier ${s.index} at height ${s.y}`);
        if (castle.columns.has(columnIndex(Math.floor(s.x), Math.floor(s.z))) && problems.length < 10) problems.push(`soldier ${s.index} inside the castle`);
        if (troop.mode === 'march') strides.add(Math.round(s.stride * 1000));
      }
      if (strides.size > 1 && problems.length < 10) problems.push('out of step');
      // A column of twos: each pair side by side, each rank its spacing behind the one ahead.
      if (troop.mode === 'march') {
        const sd = troop.soldiers;
        for (let r = 0; r + 1 < sd.length; r += 2) {
          const w = Math.hypot(sd[r]!.x - sd[r + 1]!.x, sd[r]!.z - sd[r + 1]!.z);
          if ((w < GARRISON.file * 1.2 || w > GARRISON.file * 2.6) && problems.length < 10) problems.push(`rank ${r / 2} is ${w.toFixed(2)} wide`);
          if (r + 2 < sd.length) {
            const g = Math.hypot(sd[r]!.x - sd[r + 2]!.x, sd[r]!.z - sd[r + 2]!.z);
            if ((g < GARRISON.spacing * 0.6 || g > GARRISON.spacing * 1.4) && problems.length < 10) problems.push(`ranks ${g.toFixed(2)} apart`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
    expect(halts).toBeGreaterThanOrEqual(3);
  });

  test('at night two sentries with torches stay at the gate; the rest go in; at dawn they come out', () => {
    const track = patrolOf(town.nav, castle)!;
    const c = clock(town.world.seed, 'dusk');
    const troop = createTroop(town.nav, castle, track, c.time);
    for (let i = 0; i < 30 * 30; i++) troop.step(c.tick(1 / 30), c.time);
    c.hold('night');
    for (let i = 0; i < 30 * 200 && troop.mode !== 'night'; i++) troop.step(c.tick(1 / 30), c.time);
    expect(troop.mode).toBe('night');
    expect(troop.soldiers.filter((s) => s.torch).length).toBe(2);
    const gate = town.nav.nodes[castle.gate!.node]!.cell;
    for (const s of troop.soldiers.slice(0, 2)) expect(Math.hypot(s.x - keyX(gate) - 0.5, s.z - keyZ(gate) - 0.5)).toBeLessThan(1.2);
    c.hold('day');
    for (let i = 0; i < 30 * 60 && troop.mode !== 'march'; i++) troop.step(c.tick(1 / 30), c.time);
    expect(troop.mode).toBe('march');
    expect(troop.soldiers.every((s) => !s.torch)).toBe(true);
  });

  test('round a castle on open ground the patrol is a loop, and the column halts at the gate each lap', () => {
    const open = scenarioTown(garrisonTown);
    const big = findCastles(open.shape, open.nav).find((c) => c.keep !== null)!;
    const track = patrolOf(open.nav, big)!;
    expect(track.loop).toBe(true);
    const c = clock(open.world.seed, 'day');
    const troop = createTroop(open.nav, big, track, c.time);
    let halts = 0, laps = 0, was = troop.mode, last = troop.s;
    for (let i = 0; i < 30 * 240; i++) {
      troop.step(c.tick(1 / 30), c.time);
      if (troop.mode === 'halt' && was !== 'halt') halts++;
      if (troop.s < last - track.length / 2) laps++;
      last = troop.s;
      was = troop.mode;
      for (const s of troop.soldiers) expect(big.columns.has(columnIndex(Math.floor(s.x), Math.floor(s.z)))).toBe(false);
    }
    expect(laps).toBeGreaterThanOrEqual(2);
    expect(halts).toBeGreaterThanOrEqual(laps - 1);
    expect(halts).toBeLessThanOrEqual(laps + 1);
  });

  test('a keep on its own: the troop marches round its foot and halts at the side facing the town', () => {
    const t = scenarioTown(riderTown);
    const keep = findCastles(t.shape, t.nav).find((c) => c.columns.has(columnIndex(37, 35)))!;
    expect(keep.keep).not.toBeNull();
    expect(keep.wallCells).toBe(0);
    // Its gate is right at its foot.
    const g = t.nav.nodes[keep.gate!.node]!.cell;
    expect(keep.columns.has(columnIndex(keyX(g) - keep.gate!.dx, keyZ(g) - keep.gate!.dz))).toBe(true);
    const track = patrolOf(t.nav, keep)!;
    expect(track.loop).toBe(true);
    const c = clock(t.world.seed, 'day');
    const troop = createTroop(t.nav, keep, track, c.time);
    let halts = 0, was = troop.mode;
    for (let i = 0; i < 30 * 90; i++) {
      troop.step(c.tick(1 / 30), c.time);
      if (troop.mode === 'halt' && was !== 'halt') halts++;
      was = troop.mode;
      for (const s of troop.soldiers) expect(keep.columns.has(columnIndex(Math.floor(s.x), Math.floor(s.z)))).toBe(false);
    }
    expect(halts).toBeGreaterThan(0);
  });
});
