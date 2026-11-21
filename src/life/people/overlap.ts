// For tests and watching: how often two people stand inside each other.
// Not used by the game.
//
// Two people overlap when their centres are closer than BODY (a person is
// about 0.13 across at the shoulders, a little more with arms swinging) on
// the same floor. A brief touch while two pass is allowed (BRIEF seconds); an
// overlap that lasts longer is SUSTAINED and counted once.

import type { Crowd, Person } from './crowd';

export const BODY = 0.15;
export const BRIEF = 0.25;

export interface OverlapWatch {
  /** Overlaps that lasted longer than BRIEF, each counted once. */
  sustained: number;
  /** Frames in which any pair overlapped at all. */
  touching: number;
  /** A few of the sustained ones, in words. */
  examples: string[];
  /** Sustained ones by kind: 'walk/walk same', 'walk/walk opposite', 'walk/walk across', 'walk/linger', … */
  kinds: Map<string, number>;
  check(dt: number): void;
}

/** Whether a person is out and solid: drawn, not hopping, not walking in or out of a doorway or the sea. */
export function solid(p: Person): boolean {
  if (!p.visible || p.mode === 'gone' || p.mode === 'hop' || p.mode === 'thrown' || p.fade < 1) return false;
  if (p.mode === 'walk' && p.walk && p.walk[p.at]!.kind !== 'move') return false;
  return true;
}

export function watchOverlaps(crowd: Crowd): OverlapWatch {
  const since = new Map<string, number>();
  const w: OverlapWatch = {
    sustained: 0,
    touching: 0,
    examples: [],
    kinds: new Map(),
    check(dt) {
      const out = crowd.people.filter(solid);
      const now = new Set<string>();
      for (let i = 0; i < out.length; i++) {
        for (let j = i + 1; j < out.length; j++) {
          const a = out[i]!, b = out[j]!;
          if (Math.abs(a.y - b.y) > 0.3) continue;
          const d = Math.hypot(a.x - b.x, a.z - b.z);
          if (d >= BODY) continue;
          const k = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
          now.add(k);
          const t = (since.get(k) ?? 0) + dt;
          since.set(k, t);
          if (t > BRIEF && t - dt <= BRIEF) {
            w.sustained++;
            const dot = Math.sin(a.heading) * Math.sin(b.heading) + Math.cos(a.heading) * Math.cos(b.heading);
            const kind = (a.mode === 'walk' && b.mode === 'walk' ? `walk/walk ${dot > 0.5 ? 'same' : dot < -0.5 ? 'opposite' : 'across'}` : [a.mode, b.mode].sort().join('/')) + (a.stuck < 0 || b.stuck < 0 ? ' (squeezing past)' : '');
            w.kinds.set(kind, (w.kinds.get(kind) ?? 0) + 1);
            if (w.examples.length < 400) w.examples.push(`${kind} ${d.toFixed(2)} apart at ${a.x.toFixed(2)},${a.z.toFixed(2)}: ${a.id} (${a.mode}), ${b.id} (${b.mode})`);
          }
        }
      }
      if (now.size > 0) w.touching++;
      for (const k of [...since.keys()]) if (!now.has(k)) since.delete(k);
    },
  };
  return w;
}
