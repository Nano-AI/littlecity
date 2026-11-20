// The games on their own, with stand-in players and a fixed clock: each sport
// plays something you can follow, the ball is always accounted for, the
// players stay on the court, the game ends in handshakes, and the same seed
// plays the same game.

import { describe, expect, test } from 'vitest';
import { CELL_H } from '@/core/grid';
import { courtLocal, courtOf, type Court, type FieldRole } from '@/rules/roles/field.lib';
import { basketball } from './basketball';
import { tennis } from './tennis';
import { football } from './football';
import { bowls, croquet, race } from './lawn';
import type { Athlete, Game } from './kit';

function athletes(c: Court, n: number): Athlete[] {
  return Array.from({ length: n }, (_, i) => {
    const s = i % 2 === 0 ? -1 : 1;
    return { id: `p${i}`, seed: 100 + i, child: false, x: c.cx + s * 0.4, y: c.y, z: c.cz + (Math.floor(i / 2) - 1) * 0.3, heading: 0, pose: 'stand', poseTime: 0, stride: 0 };
  });
}

export function courtFor(role: FieldRole, w: number, d: number, surface = 'hard'): Court {
  return courtOf(role, { x0: 10, z0: 10, w, d }, w >= d ? 0 : 1, 1, CELL_H, surface);
}

export interface Run {
  game: Game;
  kinds: Map<string, number>;
  problems: string[];
}

/** Steps a game to its end (or `limit` seconds), checking at every step what must always hold. */
export function run(game: Game, limit: number, dt = 1 / 30): Run {
  const problems: string[] = [];
  const c = game.court;
  let seen = 0;
  for (let t = 0; t < limit && game.phase !== 'over'; t += dt) {
    game.step(dt);
    for (const b of game.balls) {
      if (![b.x, b.y, b.z].every(Number.isFinite)) problems.push(`t=${t.toFixed(2)} ball ${b.kind} is nowhere`);
      if (b.state === 'held' && !b.holder) problems.push(`t=${t.toFixed(2)} ball held by nobody`);
      if (b.y < c.y + b.r - 1e-3) problems.push(`t=${t.toFixed(2)} ball under the court`);
      const [u, v] = courtLocal(c, b.x, b.z);
      if (Math.abs(u) > c.rl + 0.11 || Math.abs(v) > c.rw + 0.11) problems.push(`t=${t.toFixed(2)} ball off the field (${u.toFixed(2)}, ${v.toFixed(2)})`);
    }
    for (const p of game.players) {
      const [u, v] = courtLocal(c, p.a.x, p.a.z);
      if (Math.abs(u) > c.rl || Math.abs(v) > c.rw) problems.push(`t=${t.toFixed(2)} ${p.a.id} off the court`);
    }
    if (problems.length > 20) break;
    seen = game.events.length;
  }
  void seen;
  const kinds = new Map<string, number>();
  for (const e of game.events) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1);
  return { game, kinds, problems };
}

describe('the slow games', () => {
  test('bowls: the jack, bowls by turns, an end scored, the next end back the other way', () => {
    const green = courtFor('bowling-green', 4, 4, 'grass');
    const r = run(bowls(green, athletes(green, 2), { seed: 6, length: 150 }), 300);
    expect(r.problems).toEqual([]);
    expect(r.kinds.get('jack') ?? 0).toBeGreaterThanOrEqual(2);
    expect(r.kinds.get('bowl') ?? 0).toBeGreaterThanOrEqual(8);
    expect(r.kinds.get('point') ?? 0).toBeGreaterThanOrEqual(2);
    expect(r.game.phase).toBe('over');
  });

  test('boules on a strip', () => {
    const strip = courtFor('boules-court', 1, 4, 'clay');
    const r = run(bowls(strip, athletes(strip, 3), { seed: 2, length: 100 }), 240);
    expect(r.problems).toEqual([]);
    expect(r.kinds.get('point') ?? 0).toBeGreaterThanOrEqual(1);
    expect(r.game.phase).toBe('over');
  });

  test('croquet: strokes by turns, and hoops run', () => {
    const lawn = courtFor('croquet-lawn', 5, 4, 'grass');
    const r = run(croquet(lawn, athletes(lawn, 2), { seed: 1, length: 120 }), 220);
    expect(r.problems).toEqual([]);
    expect(r.kinds.get('stroke') ?? 0).toBeGreaterThanOrEqual(10);
    expect(r.kinds.get('hoop') ?? 0).toBeGreaterThanOrEqual(1);
    expect(r.game.phase).toBe('over');
  });

  test('races down the track', () => {
    const track = courtFor('running-track', 1, 6, 'clay');
    const r = run(race(track, athletes(track, 3), { seed: 1, length: 60 }), 140);
    expect(r.problems).toEqual([]);
    expect(r.kinds.get('win') ?? 0).toBeGreaterThanOrEqual(2);
    expect(r.game.phase).toBe('over');
  });
});

describe('football', () => {
  const pitch = courtFor('football-pitch', 6, 4, 'grass');

  test('three a side with goalkeepers: kick-off, passes, shots, saves or goals, handshakes', () => {
    const g = football(pitch, athletes(pitch, 6), { seed: 3, length: 150 });
    const r = run(g, 260);
    expect(r.problems).toEqual([]);
    expect(r.kinds.get('kickoff') ?? 0).toBeGreaterThanOrEqual(1);
    expect(r.kinds.get('pass') ?? 0).toBeGreaterThanOrEqual(4);
    expect(r.kinds.get('shot') ?? 0).toBeGreaterThanOrEqual(3);
    expect(r.kinds.get('goal') ?? 0).toBeGreaterThanOrEqual(1);
    expect(g.phase).toBe('over');
  });

  test('a kickabout on a green, between the jumpers', () => {
    const green = courtFor('kickabout-green', 3, 2, 'grass');
    const r = run(football(green, athletes(green, 4), { seed: 8, length: 90 }), 160);
    expect(r.problems).toEqual([]);
    expect(r.kinds.get('shot') ?? 0).toBeGreaterThanOrEqual(2);
    expect(r.game.phase).toBe('over');
  });

  test('the same seed plays the same game', () => {
    const a = run(football(pitch, athletes(pitch, 6), { seed: 5, length: 60 }), 100);
    const b = run(football(pitch, athletes(pitch, 6), { seed: 5, length: 60 }), 100);
    expect(b.game.events).toEqual(a.game.events);
  });
});

describe('tennis', () => {
  const court = courtFor('tennis-court', 5, 2, 'clay');

  test('singles: serves, rallies that cross the net several times, points, games and handshakes', () => {
    const g = tennis(court, athletes(court, 2), { seed: 9, length: 200 });
    const r = run(g, 320);
    expect(r.problems).toEqual([]);
    // The longest rally: shots (serve and hits) between two points.
    let longest = 0, n = 0;
    for (const e of g.events) {
      if (e.kind === 'serve' || e.kind === 'hit') n++;
      if (e.kind === 'point') {
        longest = Math.max(longest, n);
        n = 0;
      }
    }
    expect(longest).toBeGreaterThanOrEqual(4);
    expect(r.kinds.get('point') ?? 0).toBeGreaterThanOrEqual(6);
    expect(r.kinds.get('game') ?? 0).toBeGreaterThanOrEqual(1);
    expect((r.kinds.get('out') ?? 0) + (r.kinds.get('into-net') ?? 0)).toBeGreaterThanOrEqual(1);
    expect(g.phase).toBe('over');
  });

  test('doubles on a wide court', () => {
    const wide = courtFor('tennis-court', 6, 3, 'grass');
    const r = run(tennis(wide, athletes(wide, 4), { seed: 4, length: 120 }), 220);
    expect(r.problems).toEqual([]);
    expect(r.kinds.get('point') ?? 0).toBeGreaterThanOrEqual(4);
    expect(r.game.phase).toBe('over');
  });

  test('the same seed plays the same game', () => {
    const a = run(tennis(court, athletes(court, 2), { seed: 2, length: 60 }), 100);
    const b = run(tennis(court, athletes(court, 2), { seed: 2, length: 60 }), 100);
    expect(b.game.events).toEqual(a.game.events);
  });
});

describe('basketball', () => {
  const court = courtFor('basketball-court', 4, 3);

  test('two a side play: shots, passes, at least one basket, and it ends in handshakes', () => {
    const g = basketball(court, athletes(court, 4), { seed: 7, length: 120 });
    const r = run(g, 200);
    expect(r.problems).toEqual([]);
    expect(r.kinds.get('shot') ?? 0).toBeGreaterThanOrEqual(4);
    expect(r.kinds.get('basket') ?? 0).toBeGreaterThanOrEqual(1);
    expect(r.kinds.get('pass') ?? 0).toBeGreaterThanOrEqual(2);
    expect(g.phase).toBe('over');
    expect(r.kinds.get('end')).toBe(1);
  });

  test('three a side on the small court too', () => {
    const small = courtFor('basketball-court', 3, 2);
    const r = run(basketball(small, athletes(small, 6), { seed: 3, length: 90 }), 160);
    expect(r.problems).toEqual([]);
    expect(r.kinds.get('basket') ?? 0).toBeGreaterThanOrEqual(1);
    expect(r.game.phase).toBe('over');
  });

  test('the same seed plays the same game', () => {
    const a = run(basketball(court, athletes(court, 4), { seed: 11, length: 60 }), 100);
    const b = run(basketball(court, athletes(court, 4), { seed: 11, length: 60 }), 100);
    expect(b.game.events).toEqual(a.game.events);
    expect(b.game.score).toEqual(a.game.score);
  });
});
