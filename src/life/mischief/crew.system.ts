// A stand-in repair crew (mischief, Phase A): round every building in
// scaffolding, one builder hammering on the plank walk, one going up and
// down the ladder, one sawing on the ground by the materials and one pushing
// a barrow of rubble back and forth, with a handcart standing by. They do not
// choose what to mend or walk there: that is Phase B. Owner: Mischief.

import { CELL_H } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import { hash, rand } from '@/core/rand';
import { profileOf, type Profile } from '@/gen/damage/field';
import { ladderOf, outsideSides, sideEnds, type Side } from '@/gen/damage/scaffold';
import { buildPerson, type Look } from '@/parts/people/person';
import type { ShapePlan, StructureId } from '@/resolve/plan';
import { ruinMending } from '@/world/damage';
import { defineSystem, type InstanceHandle, type LifeStage } from '../api';
import { builderLook, CREW_TOOL_PIECE, crewPose, crewToolMesh, crewToolOf, handcartMesh, placeFigure, type CrewPose, type CrewTool } from './crew';

const PIECES = ['body', 'legL', 'legR', 'armL', 'armR'] as const;
const IDENTITY: Mat4Like = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const FPS = 12;

type Job = 'hammer' | 'climb' | 'saw' | 'barrow';

interface Builder {
  job: Job;
  look: Look;
  pieces: InstanceHandle[];
  tool: { kind: CrewTool; h: InstanceHandle } | null;
  seed: number;
  side: Side;
  ground: number;
}
interface Crew {
  builders: Builder[];
  cart: InstanceHandle | null;
  prof: Profile;
}
interface State {
  shape: ShapePlan | null;
  crews: Map<StructureId, Crew>;
  time: number;
  out: Float32Array;
}

function mending(shape: ShapePlan, id: StructureId): boolean {
  const s = shape.structures.get(id);
  if (!s || s.kind === 'tree') return false;
  return s.cells.some((c) => ruinMending(shape.world.blocks.get(c)?.ruin));
}

function hire(stage: LifeStage, shape: ShapePlan, id: StructureId): Crew | null {
  const s = shape.structures.get(id)!;
  const prof = profileOf(s, shape);
  const sides = outsideSides(prof);
  if (sides.length === 0) return null;
  const lad = ladderOf(prof, sides)!;
  const others = sides.filter((x) => x !== lad.side);
  const pick = (k: string): Side => (others.length ? others[Math.floor(rand(s.seed, 'crew', k) * others.length)]! : lad.side);
  const crew: Crew = { builders: [], cart: null, prof };
  const add = (job: Job, side: Side, ground = side.col.base): void => {
    const seed = hash(s.seed, 'builder', job);
    const look = builderLook(seed);
    const meshes = buildPerson(look, `crew${seed}`);
    crew.builders.push({ job, look, pieces: PIECES.map((p) => stage.spawnMesh(meshes[p], IDENTITY)), tool: null, seed, side, ground });
  };
  add('hammer', pick('hammer'));
  add('climb', lad.side);
  const groundSide = sides.find((x) => prof.openGround(x.col.x + x.dx, x.col.z + x.dz, x.col.base) !== null);
  if (groundSide) {
    const g = prof.openGround(groundSide.col.x + groundSide.dx, groundSide.col.z + groundSide.dz, groundSide.col.base)!;
    add('saw', groundSide, g);
    add('barrow', groundSide, g);
    crew.cart = stage.spawnMesh(handcartMesh(), IDENTITY);
  }
  return crew;
}

function fire(crew: Crew): void {
  for (const b of crew.builders) {
    for (const h of b.pieces) h.release();
    b.tool?.h.release();
  }
  crew.cart?.release();
}

/** Where a builder is and what they are doing now. */
function placeOf(b: Builder, crew: Crew, t: number): { x: number; y: number; z: number; heading: number; pose: CrewPose } {
  const { col, dx, dz } = b.side;
  const [a, c] = sideEnds(b.side);
  const tx = c[0] - a[0], tz = c[2] - a[2];
  const facingWall = Math.atan2(-dx, -dz);
  switch (b.job) {
    case 'hammer': {
      const u = 0.35 + rand(b.seed, 'at') * 0.3;
      const top = Math.max(col.base + CELL_H, Math.min(col.top, col.base + CELL_H * (1 + Math.floor(rand(b.seed, 'storey') * 2))));
      return { x: a[0] + tx * u - dx * 0.06, y: top + 0.025, z: a[2] + tz * u - dz * 0.06, heading: facingWall, pose: 'hammer' };
    }
    case 'climb': {
      const lad = ladderOf(crew.prof)!;
      // Up the ladder in four seconds, a breather at the top, down again.
      const cycle = (t + rand(b.seed, 'phase') * 9) % 10;
      const u = cycle < 4 ? cycle / 4 : cycle < 6 ? 1 : cycle < 9 ? 1 - (cycle - 6) / 3 : 0;
      const out = lad.foot * (1 - u) + 0.03 * u + 0.09;
      const y = col.base + (lad.topY - 0.25 - col.base) * u;
      const still = cycle >= 4 && cycle < 6;
      return { x: lad.mx + dx * out, y, z: lad.mz + dz * out, heading: facingWall, pose: still || u === 0 ? 'stand' : 'climb' };
    }
    case 'saw':
      return { x: col.x + 0.5 + dx * 0.72 + tx * 0.18, y: b.ground, z: col.z + 0.5 + dz * 0.72 + tz * 0.18, heading: Math.atan2(tx, tz), pose: 'saw' };
    case 'barrow': {
      // Back and forth along the side, turning at each end.
      const cycle = (t * 0.25 + rand(b.seed, 'phase')) % 2;
      const u = cycle < 1 ? cycle : 2 - cycle;
      const dir = cycle < 1 ? 1 : -1;
      const along = 0.15 + 0.7 * u;
      return { x: a[0] + tx * along + dx * 0.42, y: b.ground, z: a[2] + tz * along + dz * 0.42, heading: Math.atan2(tx * dir, tz * dir), pose: 'push' };
    }
  }
}

export default defineSystem<State>({
  id: 'mischief.crew',
  order: 12,
  create: () => ({ shape: null, crews: new Map(), time: 0, out: new Float32Array(80) }),
  sync(st, next, _prev, ctx) {
    st.shape = next.shape;
    for (const [id, crew] of st.crews) {
      if (mending(next.shape, id)) continue;
      fire(crew);
      st.crews.delete(id);
    }
    for (const id of next.shape.structures.keys()) {
      if (st.crews.has(id) || !mending(next.shape, id)) continue;
      const crew = hire(ctx.stage, next.shape, id);
      if (crew) st.crews.set(id, crew);
    }
  },
  update(st, dt, _signals, ctx) {
    const before = Math.floor(st.time * FPS);
    st.time += dt;
    if (Math.floor(st.time * FPS) === before) return;
    for (const crew of st.crews.values()) {
      for (const b of crew.builders) {
        const at = placeOf(b, crew, st.time);
        const pose = crewPose(at.pose, st.time, rand(b.seed, 'stagger'));
        const world = placeFigure(b.look, pose, at.x, at.y, at.z, at.heading, st.out);
        b.pieces.forEach((h, i) => {
          h.setMatrix(world.subarray(i * 16, i * 16 + 16));
          h.setVisible(true);
        });
        const kind = crewToolOf(at.pose, b.job === 'climb' ? 'hod' : 'plank');
        if (b.tool && b.tool.kind !== kind) {
          b.tool.h.release();
          b.tool = null;
        }
        if (kind && !b.tool) b.tool = { kind, h: ctx.stage.spawnMesh(crewToolMesh(kind), IDENTITY) };
        if (b.tool) {
          const k = CREW_TOOL_PIECE[b.tool.kind] * 16;
          b.tool.h.setMatrix(world.subarray(k, k + 16));
          b.tool.h.setVisible(true);
        }
        if (b.job === 'saw' && crew.cart) {
          const { col, dx, dz } = b.side;
          const [a, c] = sideEnds(b.side);
          const tx = c[0] - a[0], tz = c[2] - a[2];
          const cx = col.x + 0.5 + dx * 0.72 - tx * 0.22, cz = col.z + 0.5 + dz * 0.72 - tz * 0.22;
          const h = Math.atan2(tx, tz);
          crew.cart.setMatrix([Math.cos(h), 0, -Math.sin(h), 0, 0, 1, 0, 0, Math.sin(h), 0, Math.cos(h), 0, cx, b.ground, cz, 1]);
          crew.cart.setVisible(true);
        }
      }
    }
  },
  dispose(st) {
    for (const crew of st.crews.values()) fire(crew);
    st.crews.clear();
  },
});
