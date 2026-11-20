// A town under fire, with everything that lives in it watched. For tests
// and for finding what misbehaves while the town is destroyed and rebuilt
// (the owner: "when houses are destroyed, the birds that are associated with
// houses glitch out like crazy ... make sure mob behaviour is consistent
// even when nukes happen").
//
//   const t = createTurmoil(start);              // the app's own wiring, with no renderer
//   t.run(5);                                    // settle
//   t.mischief.dropNuke([24.5, 1.2, 24.5]);      // or knock, dropBomb ...
//   t.run(150);                                  // the bang and the whole mend
//   t.report()                                   // per kind of thing: churn, jumps, reversals ...
//
// What it wires is what src/app/main.ts wires: createGame → setTown(shape,
// null) and life.sync on every change, the dressing on the next poll, the
// mischief director connected to the game. Every behaviour and system is
// the discovered one, wrapped so each instance it draws is labelled with
// the behaviour or system that drew it.
//
// What it measures, per kind (a behaviour's type and variant, or the system
// that spawned a handle):
//
//   created / disposed   behaviour states made and dropped after `mark()`
//   recreated            a state dropped and one of the same kind made within
//                        half a cell of it in the same sync (identity churn)
//   changed              `changed` calls (same item, new content) after mark
//   jumps                a visible thing moving further in one frame than
//                        JUMP world units (a teleport)
//   reversals            a moving thing turning back on itself (more than
//                        135°) from one frame to the next, per visible second
//   flicker              an item made again after being dropped, beyond the first time
//   vanished             an item dropped while it was drawn (gone in a frame)
//   regrow               a thing's scale shrinking and then growing again
//                        while it is visible (the pulse), counted per episode
//   inRuin               visible seconds spent still inside or on top of a
//                        block that is half-destroyed or destroyed
//   nonFinite            frames with a NaN or infinite matrix entry

import { CELL_H, key } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import type { Edit } from '@/core/world';
import { createGame, type Game, type GameStart } from '@/app/game';
import { ruinStage } from '@/world/damage';
import type { Behaviour, InstanceHandle, LifeContext, LifeStage, Signals, System } from '@/life/api';
import { allBehaviours, allSystems } from '@/life/discover';
import { mischiefOf, type Director } from '@/life/mischief/director';
import { createLife, type Life } from '@/life/runtime';
import { createSignals, type TownSignals } from '@/life/signals';
import { recordingStage, type RecordingStage, type Recorded } from '@/life/testing/stage';

/** Further than this in one frame (world units) is a teleport, whatever the thing is. */
export const JUMP = 0.75;

export interface KindStats {
  kind: string;
  created: number;
  disposed: number;
  recreated: number;
  /** An item made again after it was dropped, more than once since mark(): popping on and off. */
  flicker: number;
  /** Dropped while it was drawn: gone in a frame, with no going (the owner: nothing pops out of existence). */
  vanished: number;
  changed: number;
  /** Seconds of visible things of this kind, summed. */
  seen: number;
  jumps: number;
  reversals: number;
  regrow: number;
  inRuin: number;
  nonFinite: number;
  /** The biggest single-frame move seen while visible. */
  maxStep: number;
}

interface Track {
  kind: string;
  /** The live sample: where it is drawn now. */
  read(): { m: ArrayLike<number> | null; visible: boolean } | null;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vz: number;
  scale: number;
  shrinking: boolean;
  still: number;
  had: boolean;
}

export interface Turmoil {
  game: Game;
  life: Life;
  signals: TownSignals;
  rec: RecordingStage;
  stage: LifeStage;
  mischief: Director;
  /** Life seconds run. */
  readonly t: number;
  /** One frame (the app's loop). */
  frame(dt?: number): void;
  run(seconds: number, fps?: number): void;
  /** Starts counting from now (what happened while settling is not counted). */
  mark(): void;
  report(): KindStats[];
  /** The live behaviour states of one kind ('swift', 'small-bird/stork'). */
  statesOf(kind: string): { state: unknown; ctx: LifeContext }[];
  /** Called after every frame with the frame's number: for a test's own watching. */
  onFrame: ((t: number) => void) | null;
}

const kindOfItem = (type: string, variant: string | undefined): string => (variant ? `${type}/${variant}` : type);

export function createTurmoil(start: GameStart, opts: { fps?: number; part?: 'day' | 'dusk' | 'night' | 'dawn' } = {}): Turmoil {
  const fps = opts.fps ?? 30;
  const rec = recordingStage();
  const signals = createSignals(start.world.seed);
  signals.hold(opts.part ?? 'day');

  // Who is drawing now: spawned handles are labelled with it.
  let owner = 'app';
  const tracks: Track[] = [];
  const stats = new Map<string, KindStats>();
  let counting = false;
  const statOf = (kind: string): KindStats => {
    let s = stats.get(kind);
    if (!s) stats.set(kind, (s = { kind, created: 0, disposed: 0, recreated: 0, flicker: 0, vanished: 0, changed: 0, seen: 0, jumps: 0, reversals: 0, regrow: 0, inRuin: 0, nonFinite: 0, maxStep: 0 }));
    return s;
  };
  const track = (kind: string, read: Track['read']): Track => {
    const t: Track = { kind, read, px: 0, py: 0, pz: 0, vx: 0, vz: 0, scale: 0, shrinking: false, still: 0, had: false };
    tracks.push(t);
    return t;
  };

  const spawnedTrack = (r: Recorded, kind: string): void => {
    track(kind, () => (r.released ? null : { m: r.matrix, visible: r.visible }));
  };
  const base = rec.stage;
  const stage: LifeStage = {
    instance: (id) => base.instance(id),
    spawn(spec, at: Mat4Like): InstanceHandle {
      const h = base.spawn(spec, at);
      spawnedTrack(rec.spawned[rec.spawned.length - 1]!, `${owner}>${kindOfItem('actor' in spec ? spec.actor : spec.prop, spec.variant)}`);
      return h;
    },
    spawnMesh(mesh, at): InstanceHandle {
      const h = base.spawnMesh(mesh, at);
      spawnedTrack(rec.spawned[rec.spawned.length - 1]!, `${owner}>mesh`);
      return h;
    },
    liftStructure: (id) => base.liftStructure(id),
    socket: (id) => base.socket(id),
  };

  // Behaviour states made and dropped within one sync: matched by kind and place to find churn.
  let dropped: { kind: string; x: number; z: number }[] = [];
  let made: { kind: string; x: number; z: number }[] = [];
  /** How many times each item has been made since mark(). */
  const comings = new Map<string, number>();
  const matchChurn = (): void => {
    for (const m of made) {
      const i = dropped.findIndex((d) => d.kind === m.kind && Math.hypot(d.x - m.x, d.z - m.z) < 0.5);
      if (i < 0) continue;
      statOf(m.kind).recreated++;
      dropped.splice(i, 1);
    }
    made = [];
    dropped = [];
  };
  const where = (ctx: LifeContext): [number, number] => {
    const m = (ctx.instance as unknown as { m: number[] | null }).m ?? ctx.instance.base;
    return [m[12]!, m[14]!];
  };
  /** Every behaviour state alive now, with its kind and context (for a test to look inside). */
  const states = new Map<object, { kind: string; ctx: LifeContext }>();
  const wrapBehaviour = (b: Behaviour): Behaviour => {
    const h = b.hooks;
    return {
      ...b,
      hooks: {
        create(item: { type: string; variant?: string }, ctx: LifeContext) {
          const kind = kindOfItem(b.type, item.variant);
          owner = kind;
          const state = h.create(item, ctx);
          owner = 'app';
          const posed = ctx.instance as unknown as { m: number[] | null; visible: boolean | null; dead?: boolean };
          const t = track(kind, () => (posed.dead ? null : { m: posed.m ?? ctx.instance.base, visible: posed.visible ?? true }));
          void t;
          if (state && typeof state === 'object') states.set(state, { kind, ctx });
          if (counting) {
            statOf(kind).created++;
            const [x, z] = where(ctx);
            made.push({ kind, x, z });
            const k = `${kind}#${(item as { id?: string }).id}`;
            const n = (comings.get(k) ?? 0) + 1;
            comings.set(k, n);
            if (n > 1) statOf(kind).flicker++;
          }
          return state;
        },
        update(state: unknown, dt: number, sig: Signals, ctx: LifeContext) {
          owner = kindOfItem(b.type, ctx.item.variant);
          h.update(state, dt, sig, ctx);
          owner = 'app';
        },
        changed: (state: unknown, ctx: LifeContext) => {
          if (counting) statOf(kindOfItem(b.type, ctx.item.variant)).changed++;
          owner = kindOfItem(b.type, ctx.item.variant);
          h.changed?.(state, ctx);
          owner = 'app';
        },
        dispose: (state: unknown, ctx: LifeContext) => {
          const kind = kindOfItem(b.type, ctx.item.variant);
          const posed = ctx.instance as unknown as { m: number[] | null; visible: boolean | null; dead: boolean };
          if (counting) {
            statOf(kind).disposed++;
            const [x, z] = where(ctx);
            dropped.push({ kind, x, z });
            const m = posed.m ?? ctx.instance.base;
            if (posed.visible !== false && Math.hypot(m[4]!, m[5]!, m[6]!) > 1e-4) statOf(kind).vanished++;
          }
          posed.dead = true;
          if (state && typeof state === 'object') states.delete(state);
          owner = kind;
          h.dispose?.(state, ctx);
          owner = 'app';
        },
      },
    };
  };
  const wrapSystem = (s: System): System => ({
    ...s,
    create: (ctx) => {
      owner = s.id;
      const st = s.create(ctx);
      owner = 'app';
      return st;
    },
    sync: s.sync
      ? (st, next, prev, ctx) => {
          owner = s.id;
          s.sync!(st, next, prev, ctx);
          owner = 'app';
        }
      : undefined,
    update: (st, dt, sig, ctx) => {
      owner = s.id;
      s.update(st, dt, sig, ctx);
      owner = 'app';
    },
  });

  const life = createLife(stage, signals, { behaviours: allBehaviours().map(wrapBehaviour), systems: allSystems().map(wrapSystem) });
  const game = createGame(start, {
    show(shape, landed: Edit | null) {
      rec.setTown(shape, null);
      life.sync({ shape, dressing: null });
      if (landed?.type === 'placeBlock') signals.emit('blockLanded', landed.cell);
      if (landed?.type === 'eraseBlock') signals.emit('blockRemoved', landed.cell);
    },
  });
  const mischief = mischiefOf(stage);
  mischief.connect({
    begin: () => game.begin(),
    apply: (e) => void game.editAll(e),
    end: () => game.end(),
    abort: () => void game.abort(),
    edit: (e) => void game.editAll(e),
    amend: (e) => void game.amend(e),
  });

  /** Is (x, y, z) inside, or sitting right on top of, a block half-destroyed or worse? */
  const inRuin = (x: number, y: number, z: number): boolean => {
    const blocks = game.world.blocks;
    const cx = Math.floor(x), cz = Math.floor(z), cy = Math.floor(y / CELL_H + 1e-3);
    for (const yy of [cy, cy - 1]) {
      if (yy < 0) continue;
      const b = blocks.get(key(cx, yy, cz));
      if (b && ruinStage(b.ruin) >= 2) return true;
    }
    return false;
  };

  let t = 0;
  const measure = (dt: number): void => {
    for (let i = 0; i < tracks.length; i++) {
      const tr = tracks[i]!;
      const s = tr.read();
      if (!s) {
        tracks[i] = tracks[tracks.length - 1]!;
        tracks.pop();
        i--;
        continue;
      }
      const m = s.m;
      if (!m) continue;
      // The up axis: a bird's wing-beat squash (across) is not a change of size.
      const scale = Math.hypot(m[4]!, m[5]!, m[6]!);
      const visible = s.visible && scale > 1e-4;
      let finite = true;
      for (let k = 0; k < 16; k++) if (!Number.isFinite(m[k]!)) finite = false;
      const st = counting ? statOf(tr.kind) : null;
      if (!finite) {
        if (st) st.nonFinite++;
        tr.had = false;
        continue;
      }
      const x = m[12]!, y = m[13]!, z = m[14]!;
      if (!visible) {
        tr.had = false;
        continue;
      }
      if (tr.had) {
        const dx = x - tr.px, dy = y - tr.py, dz = z - tr.pz;
        const d = Math.hypot(dx, dy, dz);
        const flat = Math.hypot(dx, dz);
        if (st) {
          st.seen += dt;
          st.maxStep = Math.max(st.maxStep, d);
          if (d > JUMP) st.jumps++;
          const prev = Math.hypot(tr.vx, tr.vz);
          if (flat > 0.004 && prev > 0.004 && d <= JUMP && (dx * tr.vx + dz * tr.vz) / (flat * prev) < -0.7) st.reversals++;
          if (scale < tr.scale - 1e-4) tr.shrinking = true;
          else if (scale > tr.scale + 1e-4) {
            if (tr.shrinking) st.regrow++;
            tr.shrinking = false;
          }
          tr.still = d < 1e-4 ? tr.still + dt : 0;
          if (tr.still > 0.5 && inRuin(x, y, z)) st.inRuin += dt;
        }
        if (flat > 0.004) {
          tr.vx = dx;
          tr.vz = dz;
        }
      } else {
        tr.vx = tr.vz = 0;
        tr.shrinking = false;
        tr.still = 0;
      }
      tr.px = x;
      tr.py = y;
      tr.pz = z;
      tr.scale = scale;
      tr.had = true;
    }
  };

  const out: Turmoil = {
    game,
    life,
    signals,
    rec,
    stage,
    mischief,
    get t() {
      return t;
    },
    onFrame: null,
    frame(step = 1 / fps) {
      const dt = signals.advance(step);
      const ready = game.poll();
      if (ready) {
        rec.setTown(ready.shape, ready.dressing);
        life.sync(ready);
        matchChurn();
      }
      life.update(dt);
      mischief.flush();
      t += dt;
      measure(dt);
      out.onFrame?.(t);
    },
    run(seconds, rate = fps) {
      const n = Math.round(seconds * rate);
      for (let i = 0; i < n; i++) out.frame(1 / rate);
    },
    statesOf(kind) {
      const out: { state: unknown; ctx: LifeContext }[] = [];
      for (const [state, v] of states) if (v.kind === kind) out.push({ state, ctx: v.ctx });
      return out;
    },
    mark() {
      counting = true;
      stats.clear();
      comings.clear();
    },
    report() {
      return [...stats.values()].sort((a, b) => (a.kind < b.kind ? -1 : 1));
    },
  };
  // The first dressing.
  out.frame();
  return out;
}
