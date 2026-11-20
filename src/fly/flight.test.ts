// Fly mode's solid world and its flying (design section 7, "Fly mode"): what
// is in the way, that the eye stops short of it and slides along it, the
// box it keeps to, the speeds, and the way back out never passing through
// anything.

import { describe, expect, test } from 'vitest';
import { CELL_H, SEA_Y, SIZE_X } from '@/core/grid';
import { townOf } from '@/life/people/testing';
import { flatTerrain } from '@/scenario';
import { changeSpeed, clearAt, FLIGHT, flightBox, startFlight, stepFlight, type FlightInput, type FlightState } from './flight';
import { along, clearPath, planPath, type Vec3 } from './glide';
import { createSolidMap, type SolidMap } from './solid';

const R = FLIGHT.radius;
/** Ground level 1 (top at 0.8) from column 4 to 43; sea round it. */
const GROUND = CELL_H;

/** A house two storeys tall over columns 10–11 × 10–11, a tree at (20, 20), a fence on the north side of (30, 30). */
function town(): SolidMap {
  const t = townOf((b) => {
    b.house(10, 10, { floors: 2, w: 2, d: 2 });
    b.put('tree', 20, 20);
    b.fenceEdge(30, 30, 'N');
  }, flatTerrain(7));
  return createSolidMap(t.shape, t.dressing);
}

const none: FlightInput = { forward: 0, strafe: 0, rise: 0 };
const fly = (map: SolidMap, f: FlightState, input: Partial<FlightInput>, seconds: number, each?: () => void): void => {
  for (let i = 0; i < seconds * 60; i++) {
    stepFlight(map, f, { ...none, ...input }, 1 / 60);
    each?.();
  }
};

describe('what is in the way', () => {
  const map = town();
  test('buildings, their roofs, the ground and the sea', () => {
    // Inside the house, both storeys.
    expect(map.hidden(10.5, GROUND + 0.4, 10.5)).toBe(true);
    expect(map.hidden(11.5, GROUND + CELL_H + 0.4, 11.5)).toBe(true);
    // Its roof, over the top storey, and clear air well above it.
    const eaves = GROUND + 2 * CELL_H;
    expect(map.hidden(10.5, eaves + 0.5, 10.5)).toBe(true);
    expect(map.hidden(10.5, eaves + 1.2, 10.5)).toBe(false);
    expect(map.top).toBeGreaterThanOrEqual(eaves + 0.9);
    // Beside it, the street is open.
    expect(map.hidden(9.5, GROUND + 0.4, 10.5)).toBe(false);
    // Under the ground and under the sea.
    expect(map.hidden(6.5, GROUND - 0.1, 6.5)).toBe(true);
    expect(map.hidden(1.5, SEA_Y - 0.05, 1.5)).toBe(true);
    expect(map.hidden(1.5, SEA_Y + 0.05, 1.5)).toBe(false);
    // Off the map, under the sea too.
    expect(map.hidden(-5, SEA_Y - 0.05, -5)).toBe(true);
  });
  test('a tree (trunk and crown) and a fence on a cell side', () => {
    expect(map.hidden(20.5, GROUND + 0.3, 20.5)).toBe(true);
    expect(map.hidden(20.5, GROUND + CELL_H + 0.3, 20.5)).toBe(true);
    expect(map.hidden(30.5, GROUND + 0.3, 30.02)).toBe(true);
    expect(map.hidden(30.5, GROUND + 0.3, 30.5)).toBe(false);
  });
});

describe('flying', () => {
  const map = town();
  test('at a house it stops short of the wall, never inside it, and slides along it', () => {
    // Facing east (yaw −90) at the house's west wall (x = 10), at the height of its lower storey.
    const f = startFlight(map, [5.5, GROUND + 0.4, 10.4], -90, 0);
    fly(map, f, { forward: 1 }, 3, () => expect(clearAt(map, f.eye)).toBe(true));
    expect(f.eye[0]).toBeLessThanOrEqual(10 - R + 1e-6);
    expect(f.eye[0]).toBeGreaterThan(10 - R - 0.02);
    expect(f.vel[0]).toBe(0);
    // Turned half toward the south-east: it keeps to the wall and slides south along it.
    f.yaw = -135;
    const z0 = f.eye[2];
    fly(map, f, { forward: 1 }, 0.25, () => expect(clearAt(map, f.eye)).toBe(true));
    expect(f.eye[0]).toBeLessThanOrEqual(10 - R + 1e-6);
    expect(f.eye[2]).toBeGreaterThan(z0 + 0.4);
    expect(f.eye[2]).toBeLessThan(12);
  });

  test('down onto a roof it stops above it; down onto the ground, above the ground', () => {
    const f = startFlight(map, [10.5, 6, 10.5], 0, -89);
    fly(map, f, { rise: -1 }, 3, () => expect(clearAt(map, f.eye)).toBe(true));
    expect(f.eye[1]).toBeGreaterThan(GROUND + 2 * CELL_H + 0.9);
    const g = startFlight(map, [6.5, 3, 6.5], 0, 0);
    fly(map, g, { rise: -1 }, 3);
    expect(g.eye[1]).toBeCloseTo(GROUND + R, 1);
    expect(g.eye[1]).toBeGreaterThanOrEqual(GROUND + R - 1e-6);
  });

  test('over the sea it stays above the water', () => {
    const f = startFlight(map, [1.5, 2, 1.5], 0, 0);
    fly(map, f, { rise: -1 }, 3);
    expect(f.eye[1]).toBeGreaterThanOrEqual(SEA_Y + R - 1e-6);
    expect(f.eye[1]).toBeLessThan(SEA_Y + R + 0.02);
  });

  test('it stays over the map: a margin round it and a ceiling', () => {
    const box = flightBox(map);
    const f = startFlight(map, [24, 3, 24], 90, 0, FLIGHT.maxScale);
    fly(map, f, { forward: 1 }, 8);
    expect(f.eye[0]).toBeCloseTo(-FLIGHT.margin, 3);
    fly(map, f, { rise: 1 }, 8);
    expect(f.eye[1]).toBeCloseTo(box.hi[1], 3);
    expect(box.hi[1]).toBeCloseTo(map.top + FLIGHT.headroom, 6);
  });

  test('starting far outside (where the builder camera was), it may come in but not go farther out, and once in it stays in', () => {
    const f = startFlight(map, [-40, 50, 24], 90, 0);
    fly(map, f, { forward: 1 }, 1);
    expect(f.eye[0]).toBeCloseTo(-40, 6);
    expect(f.eye[1]).toBeCloseTo(50, 6);
    // In and down (yaw −90 looks east).
    f.yaw = -90;
    f.pitch = -30;
    fly(map, f, { forward: 1 }, 12);
    expect(f.eye[0]).toBeGreaterThan(-FLIGHT.margin);
    f.yaw = 90;
    f.pitch = 0;
    fly(map, f, { forward: 1 }, 6);
    expect(f.eye[0]).toBeCloseTo(-FLIGHT.margin, 3);
  });

  test('speed eases in and out, crosses the island in about eight seconds, and the wheel sets a quarter to four times it', () => {
    const f = startFlight(map, [5, 6, 24], -90, 0);
    fly(map, f, { forward: 1 }, 0.1);
    const early = Math.hypot(...f.vel);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(FLIGHT.speed * 0.7);
    fly(map, f, { forward: 1 }, 1);
    expect(Math.hypot(...f.vel)).toBeCloseTo(FLIGHT.speed, 1);
    expect(SIZE_X / FLIGHT.speed).toBeGreaterThanOrEqual(6);
    expect(SIZE_X / FLIGHT.speed).toBeLessThanOrEqual(10);
    // Let go: it comes to rest, smoothly (slower each step, never backwards).
    let last = Math.hypot(...f.vel);
    fly(map, f, {}, 1.5, () => {
      const v = Math.hypot(...f.vel);
      expect(v).toBeLessThanOrEqual(last + 1e-9);
      last = v;
    });
    expect(Math.hypot(...f.vel)).toBe(0);
    changeSpeed(f, -50);
    expect(f.scale).toBe(FLIGHT.minScale);
    changeSpeed(f, 50);
    expect(f.scale).toBe(FLIGHT.maxScale);
    expect(FLIGHT.minScale).toBe(0.25);
    expect(FLIGHT.maxScale).toBe(4);
  });
});

describe('the way back out', () => {
  const map = town();
  test('from beside the house to high over the island, the path passes through nothing', () => {
    const from: Vec3 = [9.6, GROUND + 0.3, 10.5];
    const to: Vec3 = [-20, 40, 60];
    const path = planPath(map, from, to, -90, 45);
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);
    for (let i = 0; i <= 400; i++) {
      const p = along(path, i / 400);
      expect(map.hidden(p[0], p[1], p[2])).toBe(false);
    }
  });
  test('a straight line that would cut through the house is not taken', () => {
    const from: Vec3 = [9.6, GROUND + 0.3, 10.5];
    const to: Vec3 = [13, GROUND + 0.3, 10.5];
    expect(clearPath(map, from, to)).toBe(false);
    const path = planPath(map, from, to, -90, 90);
    expect(path.length).toBeGreaterThan(2);
    for (let i = 0; i <= 400; i++) {
      const p = along(path, i / 400);
      expect(map.hidden(p[0], p[1], p[2])).toBe(false);
    }
  });
});
