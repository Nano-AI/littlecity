// The flames read a burning building's roof from the town's own drawing; they never draw it themselves.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { allGenerators, allParts } from '@/gen/discover';
import type { GenOutput } from '@/gen/api';
import type { ShapePlan } from '@/resolve/plan';
import { town } from '@/parts/monuments/testing';
import { samplerOf } from './mischief.system';

afterEach(() => vi.restoreAllMocks());

type Reg = ReturnType<typeof allGenerators> & { peek: (sid: number) => { hash: number; out: GenOutput } | null };

function setup() {
  const t = town((b) => b.house(14, 20, { floors: 2, color: 0 }));
  const s = t.plan.structures.get([...t.plan.structures.keys()][0]!)!;
  const reg = allGenerators() as Reg;
  const out = reg.build(s, t.plan, allParts());
  const at = (hash: number): ShapePlan => ({ ...t.plan, structures: new Map([[s.id, { ...s, hash }]]) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const st: any = { samplers: new Map(), time: 0, built: 0 };
  return { s, reg, out, at, st };
}

describe('the flames find a roof', () => {
  test("a burning building's flames keep their old roof until the town has drawn the new one", () => {
    const { s, reg, out, at, st } = setup();
    vi.spyOn(reg, 'peek').mockReturnValue({ hash: 1, out });
    const build = vi.spyOn(reg, 'build');
    const first = samplerOf(st, at(1), s.id);
    expect(first).not.toBeNull();
    // The edit lands (hash 2) but the renderer has not drawn it: long past the throttle, still no build.
    st.time = 10;
    expect(samplerOf(st, at(2), s.id)).toBe(first);
    expect(build).not.toHaveBeenCalled();
  });

  test('the flames move to the new roof once it is drawn', () => {
    const { s, reg, out, at, st } = setup();
    const peek = vi.spyOn(reg, 'peek').mockReturnValue({ hash: 1, out });
    const first = samplerOf(st, at(1), s.id);
    peek.mockReturnValue({ hash: 2, out });
    st.time = 0.5; // the throttle still holds
    expect(samplerOf(st, at(2), s.id)).toBe(first);
    st.time = 10;
    const next = samplerOf(st, at(2), s.id);
    expect(next).not.toBe(first);
    expect(st.samplers.get(s.id).hash).toBe(2);
  });

  test('with nothing drawn yet it builds, once', () => {
    const { s, reg, at, st } = setup();
    vi.spyOn(reg, 'peek').mockReturnValue(null);
    const build = vi.spyOn(reg, 'build');
    expect(samplerOf(st, at(1), s.id)).not.toBeNull();
    expect(build).toHaveBeenCalledTimes(1);
  });
});

describe('a blast lights many buildings at once', () => {
  test("a blast's first fires build at most one roof a frame", () => {
    const t = town((b) => { for (let i = 0; i < 5; i++) b.house(14 + i * 3, 20, { floors: 2, color: i }); });
    const reg = allGenerators() as Reg;
    vi.spyOn(reg, 'peek').mockReturnValue(null);
    const build = vi.spyOn(reg, 'build');
    const ids = [...t.plan.structures.keys()];
    expect(ids.length).toBeGreaterThanOrEqual(4);
    const st = { samplers: new Map(), time: 0, built: 0 } as never as Parameters<typeof samplerOf>[0] & { built: number };
    for (let frame = 1; frame <= ids.length; frame++) {
      st.built = 0;
      const before = build.mock.calls.length;
      for (const id of ids) samplerOf(st, t.plan, id);
      expect(build.mock.calls.length - before).toBe(1);
      expect(st.samplers.size).toBe(frame);
    }
  });
});
