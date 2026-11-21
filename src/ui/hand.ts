// The Mischief drawer's Hand (design section 13b, "the Hand"). Owner:
// Mischief.
//
// Over something it can pick up (a person out in the town, a dog, a cat, a
// hen, a sheep, a soldier), the cursor is an open hand and a ring is drawn on
// the ground round it. Press on it: it is picked up, and hangs from the
// pointer, kicking, lifted clear above the roofs, with its shadow and a line
// down to the ground under it. Let go: it drops; let go while moving: it is
// thrown, the pointer's speed deciding how far (a flick sends it across the
// island). Then it flies, lands and gets up as anybody blown about does
// (src/life/mischief/thrower.ts). Escape, or another tool, drops it gently.
//
// Nothing about it is saved and nothing needs undoing: undo sets everybody
// thrown back on their feet. In fly mode the tray is hidden, so the Hand
// cannot be held there.

import type { Person } from '@/life/people/crowd';
import { crowdOf } from '@/life/doors/table';
import { crittersOf, type Critter } from '@/life/mischief/critters';
import { throwerOf } from '@/life/mischief/thrown.system';
import type { Thrower } from '@/life/mischief/thrower';
import type { TownView } from '@/render/api';

/** How near the pointer (CSS pixels) a thing must be to be picked up: more on a touch screen. */
const REACH = { mouse: 26, touch: 40 };
/** How high over the roofs (world units) a held thing hangs, and how fast a throw may be (units a second). */
const CLEAR = 0.9;
const FASTEST = 15;
/** The pointer's speed is read over this long before it lets go (ms). */
const FLICK_MS = 110;

type Held = { kind: 'person'; p: Person } | { kind: 'critter'; c: Critter };

export interface Hand {
  /** The pointer rests here: is there something to pick up (the cursor and the ring say so)? */
  hover(x: number, y: number, touch?: boolean): boolean;
  /** No pointer over the town. */
  hoverEnd(): void;
  /** A press: picks up what is under it. True if it did. */
  grab(x: number, y: number, touch?: boolean): boolean;
  /** The pointer moved, holding. */
  move(x: number, y: number): void;
  /** Let go: dropped, or thrown if the pointer was moving. */
  release(): void;
  /** Put down gently where it is (Escape, another tool). */
  drop(): void;
  readonly holding: boolean;
}

export function createHand(view: TownView, now: () => number = () => performance.now()): Hand {
  let held: Held | null = null;
  let height = 0;
  let trail: { t: number; x: number; y: number; z: number }[] = [];

  const thrower = (): Thrower | null => throwerOf(view.stage);

  /** What is under the pointer: the nearest on screen within reach, people first among equals. */
  const under = (x: number, y: number, touch: boolean): Held | null => {
    const reach = touch ? REACH.touch : REACH.mouse;
    let best: Held | null = null;
    let bestD = reach;
    const crowd = crowdOf(view.stage);
    for (const p of crowd?.people ?? []) {
      if (!p.visible || p.mode === 'home' || p.mode === 'visit' || p.mode === 'gone' || p.fade < 0.5 || p.inCloud) continue;
      // Not while they fly (the Hand takes them from the ground, or lying there dizzy).
      if (p.mode === 'thrown' && p.tumble?.rot) continue;
      const [sx, sy] = view.worldToScreen([p.x, p.y + (p.mode === 'thrown' ? 0 : 0.2), p.z]);
      const d = Math.hypot(sx - x, sy - y);
      if (d < bestD) {
        bestD = d;
        best = { kind: 'person', p };
      }
    }
    for (const c of crittersOf(view.stage).values()) {
      if (c.quiet > 2) continue;
      const b = c.body;
      if (b && !b.upright) continue;
      const [sx, sy] = b ? view.worldToScreen([b.x, b.y, b.z]) : view.worldToScreen([c.x, c.y + c.height * 0.5, c.z]);
      const d = Math.hypot(sx - x, sy - y) + 4;
      if (d < bestD) {
        bestD = d;
        best = { kind: 'critter', c };
      }
    }
    return best;
  };

  const where = (h: Held): { x: number; y: number; z: number } => {
    if (h.kind === 'person') return { x: h.p.x, y: h.p.y, z: h.p.z };
    const b = h.c.body;
    return b ? { x: b.x, y: b.y, z: b.z } : { x: h.c.x, y: h.c.y, z: h.c.z };
  };

  /** Where the pointer's ray meets the height things are carried at, kept clear above whatever is under it. */
  const carryPoint = (x: number, y: number): { x: number; y: number; z: number } | null => {
    const ray = view.screenToRay(x, y);
    const [ox, oy, oz] = ray.origin, [dx, dy, dz] = ray.dir;
    if (dy > -1e-3) return null;
    const g = thrower()?.ground;
    let h = height;
    for (let k = 0; k < 3; k++) {
      const t = (h - oy) / dy;
      const px = ox + dx * t, pz = oz + dz * t;
      // Over the roofs round here, never lower than where it was picked up from.
      let top = 0;
      if (g) for (const [ax, az] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]] as const) top = Math.max(top, g.surface(px + ax, pz + az, 99).h);
      const want = Math.max(top + CLEAR, height);
      if (Math.abs(want - h) < 0.02) break;
      h = want;
    }
    // Eased toward the height it wants (no jump as it passes over a tower).
    height += (h - height) * 0.35;
    const t = (height - oy) / dy;
    return { x: ox + dx * t, y: height, z: oz + dz * t };
  };

  const setHover = (h: Held | null): void => {
    const t = thrower();
    if (!t) return;
    if (!h) {
      t.hover = null;
      return;
    }
    // Round it where it is each frame (it walks on).
    t.hover = () => {
      const at = where(h);
      return { x: at.x, y: h.kind === 'person' && h.p.mode === 'thrown' ? at.y - 0.17 : at.y, z: at.z, r: h.kind === 'critter' ? Math.max(0.25, h.c.height * 1.3) : 0.32 };
    };
  };

  const let_go = (vx: number, vy: number, vz: number, gentle: boolean): void => {
    const t = thrower(), h = held;
    held = null;
    trail = [];
    if (!t || !h) return;
    const opts = gentle ? { dizzy: 0.6, spin: 1 } : {};
    if (gentle) {
      // Lowered nearly to the ground first: a short drop, not a fall from over the roofs.
      const at = where(h), g = t.ground;
      const s = g?.surface(at.x, at.z, at.y);
      if (s) {
        const y = (s.water ? 0.4 : s.h) + 0.3;
        if (h.kind === 'person') t.carry(h.p, at.x, Math.min(at.y, y), at.z);
        else t.carryCritter(h.c, at.x, Math.min(at.y, y), at.z);
      }
    }
    if (h.kind === 'person') t.fling(h.p, vx, vy, vz, opts);
    else t.flingCritter(h.c, vx, vy, vz, opts);
  };

  return {
    get holding() {
      // Undo (or a new town) set it down under us.
      if (held && held.kind === 'person' && held.p.mode !== 'thrown') held = null;
      if (held && held.kind === 'critter' && held.c.body?.phase !== 'held') held = null;
      return held !== null;
    },
    hover(x, y, touch = false) {
      if (held) return true;
      const h = under(x, y, touch);
      setHover(h);
      return h !== null;
    },
    hoverEnd() {
      if (!held) setHover(null);
    },
    grab(x, y, touch = false) {
      const t = thrower();
      const h = under(x, y, touch);
      if (!t || !h) return false;
      const ok = h.kind === 'person' ? t.grab(h.p) : t.grabCritter(h.c);
      if (!ok) return false;
      held = h;
      height = where(h).y;
      trail = [];
      setHover(null);
      // Up it comes, off the ground, before the pointer has moved.
      const at = carryPoint(x, y) ?? where(h);
      const lift = where(h);
      const first = { x: lift.x + (at.x - lift.x) * 0.3, y: Math.max(at.y, lift.y + 0.4), z: lift.z + (at.z - lift.z) * 0.3 };
      if (h.kind === 'person') t.carry(h.p, first.x, first.y, first.z);
      else t.carryCritter(h.c, first.x, first.y, first.z);
      navigator.vibrate?.(10);
      return true;
    },
    move(x, y) {
      const t = thrower();
      if (!t || !held) return;
      const at = carryPoint(x, y);
      if (!at) return;
      // Hanging from the pointer, a little below it (something big hangs by its top, its keel clear of the roofs).
      const hang = { x: at.x, y: at.y - 0.05 + (held.kind === 'critter' && held.c.height > 0.6 ? held.c.height * 0.5 : 0), z: at.z };
      if (held.kind === 'person') t.carry(held.p, hang.x, hang.y, hang.z);
      else t.carryCritter(held.c, hang.x, hang.y, hang.z);
      const ms = now();
      trail.push({ t: ms, ...hang });
      while (trail.length > 2 && ms - trail[0]!.t > FLICK_MS * 2) trail.shift();
    },
    release() {
      if (!held) return;
      const ms = now();
      const recent = trail.filter((s) => ms - s.t <= FLICK_MS);
      let vx = 0, vz = 0;
      if (recent.length >= 2) {
        const a = recent[0]!, b = recent[recent.length - 1]!;
        const dt = Math.max(16, b.t - a.t) / 1000;
        vx = (b.x - a.x) / dt;
        vz = (b.z - a.z) / dt;
      }
      const sp = Math.hypot(vx, vz);
      if (sp > FASTEST) {
        vx *= FASTEST / sp;
        vz *= FASTEST / sp;
      }
      // Moving: thrown, with a little loft; still: dropped where it hangs.
      if (sp < 0.8) let_go(0, 0, 0, false);
      else let_go(vx, 1.5 + Math.min(sp, FASTEST) * 0.18, vz, false);
    },
    drop() {
      if (held) let_go(0, 0, 0, true);
    },
  };
}
