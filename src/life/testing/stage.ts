// A LifeStage with no renderer, for tests: it remembers what life did to
// each instance, so a test can step the simulation with fixed time steps and
// read where things are.
//
//   const { stage, of, spawned } = recordingStage(town);
//   const life = createLife(stage, signals, { behaviours: [mine], systems: [] });
//   life.sync(town);
//   step(life, signals, 2);                    // two seconds at 60 fps
//   of('L03.sails@1234').matrix                // the last matrix it was given
//
// Sockets and item frames come from the real layout (src/gen/layout.ts) with
// no generator anchors, so they sit at their fallback frames: good enough to
// test motion, and exact for anything anchored to a cell.

import { identity, type Mat4, type Mat4Like } from '@/core/mat4';
import { createLayout, type Layout } from '@/gen/layout';
import type { MeshData } from '@/gen/mesh';
import type { DressingPlan, ShapePlan, StructureId } from '@/resolve/plan';
import type { InstanceHandle, LifeRuntime, LifeStage, SignalsDriver, SpawnSpec } from '../api';

export interface Recorded {
  /** What it is: an item id, 'structure:<id>', 'spawn:<n>' or 'mesh:<n>'. */
  id: string;
  spec?: SpawnSpec;
  base: Mat4;
  matrix: Mat4;
  visible: boolean;
  params: [number, number, number, number];
  released: boolean;
  /** How many times setMatrix was called. */
  moves: number;
}

export interface RecordingStage {
  stage: LifeStage;
  /** The record of an item ('<item id>') or a lifted structure ('structure:<id>'); made on first use. */
  of(id: string): Recorded;
  /** Everything spawned with stage.spawn or spawnMesh, in order. */
  spawned: Recorded[];
  /** Structures now lifted (lifts minus releases). */
  lifted: Map<StructureId, number>;
  /** Point the stage at a new town (what view.setTown / setDressing do). */
  setTown(shape: ShapePlan, dressing: DressingPlan | null): void;
}

export function recordingStage(town?: { shape: ShapePlan; dressing: DressingPlan | null }): RecordingStage {
  const records = new Map<string, Recorded>();
  const spawned: Recorded[] = [];
  const lifted = new Map<StructureId, number>();
  let layout: Layout | null = null;
  let dressing: DressingPlan | null = null;
  let ids = new Set<string>();

  const record = (id: string, base: Mat4Like, spec?: SpawnSpec): Recorded => ({
    id,
    spec,
    base: Array.from(base),
    matrix: Array.from(base),
    visible: true,
    params: [1, 0, 0, 0],
    released: false,
    moves: 0,
  });
  const handleOf = (r: Recorded, onRelease?: () => void): InstanceHandle => {
    let released = false;
    return {
      get base() {
        return r.base;
      },
      setMatrix(m) {
        r.matrix = Array.from(m);
        r.moves++;
      },
      setVisible(v) {
        r.visible = v;
      },
      setParams(a, b = 0, c = 0, d = 0) {
        r.params = [a, b, c, d];
      },
      release() {
        if (released) return;
        released = true;
        r.released = true;
        onRelease?.();
      },
    };
  };
  const of = (id: string): Recorded => {
    let r = records.get(id);
    if (!r) records.set(id, (r = record(id, layout?.item(id)?.frame ?? identity())));
    return r;
  };

  const out: RecordingStage = {
    spawned,
    lifted,
    of,
    setTown(shape, next) {
      if (next) dressing = next;
      layout = createLayout({ shape, dressing, anchors: {} });
      if (next) {
        ids = new Set([...next.props.map((p) => p.id), ...next.actors.map((a) => a.id)]);
        // Like the renderer: every item is put back at its base and shown.
        for (const id of ids) {
          const r = of(id);
          r.base = layout.item(id)?.frame ?? identity();
          r.matrix = [...r.base];
          r.visible = true;
        }
      }
    },
    stage: {
      instance: (id) => (ids.has(id) ? handleOf(of(id)) : null),
      spawn(spec, at) {
        const r = record(`spawn:${spawned.length}`, at, spec);
        spawned.push(r);
        return handleOf(r);
      },
      spawnMesh(_mesh: MeshData, at) {
        const r = record(`mesh:${spawned.length}`, at);
        spawned.push(r);
        return handleOf(r);
      },
      liftStructure(id) {
        lifted.set(id, (lifted.get(id) ?? 0) + 1);
        const r = of(`structure:${id}`);
        r.released = false;
        return handleOf(r, () => {
          const n = (lifted.get(id) ?? 1) - 1;
          if (n <= 0) {
            lifted.delete(id);
            r.matrix = identity();
          } else {
            lifted.set(id, n);
            r.released = false;
          }
        });
      },
      socket: (id) => layout?.socket(id) ?? null,
    },
  };
  if (town) out.setTown(town.shape, town.dressing);
  return out;
}

/** Steps life for `seconds` at a fixed frame rate, the way the app's frame loop does. */
export function step(life: LifeRuntime, signals: SignalsDriver, seconds: number, fps = 60): void {
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) life.update(signals.advance(1 / fps));
}
