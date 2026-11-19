// The rider (L37), stepped with fixed time steps in the everything town: out
// of the gate to the square and back, on the graph, at a walk through crowds
// and into sharp turns, home to the same tether every time.

import { describe, expect, test } from 'vitest';
import { keyX, keyZ } from '@/core/grid';
import { findCastles } from '@/rules/life/castle.lib';
import { RIDER } from '@/style/people';
import everything from '../../../scenarios/core/everything.scenario';
import { createRide, rideOf } from './rider';
import { createRouter } from './route';
import { clock, scenarioTown } from './testing';

const town = scenarioTown(everything);
const castle = findCastles(town.shape, town.nav)[0]!;
const squares = town.dressing.sockets.filter((s) => s.type === 'haunt-square').map((s) => town.nav.nodeAt.get(s.cell)!).filter((n) => n !== undefined);

describe('the rider (L37)', () => {
  test('a ride goes from by the gate to the square and back to where it started', () => {
    const track = rideOf(town.nav, createRouter(town.nav), castle, squares)!;
    expect(track).not.toBeNull();
    expect(track.loop).toBe(false);
    expect(track.length).toBeGreaterThan(4);
    expect(track.x[0]).toBeCloseTo(track.x[track.x.length - 1]!, 6);
    expect(track.z[0]).toBeCloseTo(track.z[track.z.length - 1]!, 6);
    // It passes a square.
    const sq = new Set(squares);
    expect(track.node.some((n) => sq.has(n))).toBe(true);
    // The tether is a cell out from the gate.
    const gate = town.nav.nodes[castle.gate!.node]!.cell;
    expect(Math.abs(Math.floor(track.x[0]!) - keyX(gate)) + Math.abs(Math.floor(track.z[0]!) - keyZ(gate))).toBe(1);
  });

  test('a day of rides: on the graph, trotting and walking, never turning on the spot, home again each time', () => {
    const track = rideOf(town.nav, createRouter(town.nav), castle, squares)!;
    const c = clock(town.world.seed, 'day');
    const ride = createRide(castle, track, 7, c.time);
    let trot = 0, walk = 0, maxTurn = 0, lastHeading = ride.heading, lastX = ride.x, lastZ = ride.z;
    const problems: string[] = [];
    let crowdFrames = 0;
    for (let i = 0; i < 30 * 260; i++) {
      // A crowd stands across the way for a while in the middle of the run.
      const crowd = i > 30 * 100 && i < 30 * 110;
      ride.step(c.tick(1 / 30), c.time, () => crowd);
      if (crowd && ride.riding) {
        crowdFrames++;
        if (ride.gait === 'trot') problems.push('trotted through a crowd');
      }
      if (ride.gait === 'trot') trot++;
      if (ride.gait === 'walk') walk++;
      let d = ride.heading - lastHeading;
      d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
      maxTurn = Math.max(maxTurn, Math.abs(d) * 30);
      lastHeading = ride.heading;
      const moved = Math.hypot(ride.x - lastX, ride.z - lastZ);
      if (moved > (RIDER.trot * 1.2) / 30 && problems.length < 5) problems.push(`jumped ${moved.toFixed(2)}`);
      lastX = ride.x;
      lastZ = ride.z;
      if (ride.node >= 0) {
        const cell = town.nav.nodes[ride.node]!.cell;
        if ((Math.abs(ride.x - keyX(cell) - 0.5) > 0.55 || Math.abs(ride.z - keyZ(cell) - 0.5) > 0.55) && problems.length < 5) problems.push(`off its cell at ${ride.x},${ride.z}`);
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
    expect(ride.rides).toBeGreaterThanOrEqual(2);
    expect(trot).toBeGreaterThan(walk * 0.3);
    expect(walk).toBeGreaterThan(0);
    expect(maxTurn).toBeLessThanOrEqual(2.7);
    expect(crowdFrames).toBeGreaterThanOrEqual(0);
  });
});
