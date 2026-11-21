// A raider drawn by the raid itself (design section 13b): aboard a ship or a
// boat, jumping over the side, wading in the shallows, swimming. Ashore a
// raider is one of the crowd (people.system draws them); at sea the raid
// draws them with exactly the same pieces and the same look, so the hand-over
// at the water's edge does not show.

import type { Mat4Like } from '@/core/mat4';
import type { InstanceHandle, LifeStage } from '@/life/api';
import type { MeshData } from '@/gen/mesh';
import { barbarianLook, barbarianMesh, raiderGear, type Barbarian } from '@/parts/people/barbarian';
import { TOOL_PIECE, toolMesh } from '@/parts/people/extras';
import { applyHold } from '@/parts/people/hands';
import { carriedMesh, HOLD_OF, holdAnchor, type Load } from '@/parts/people/loads';
import { buildPerson, lookOf, PIECES, rigOf, type Look, type Rig } from '@/parts/people/person';
import { poseOf, rigMatrices, sitDrop, type Pose, type PoseName } from '@/parts/people/pose';

const IDENTITY: Mat4Like = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const local = new Float32Array(96);
const world = new Float32Array(96);

/** The look a raider has, from the crowd's look number and the costume (as people.system works it out). */
export function raiderLook(look: number, costume: Barbarian): Look {
  return barbarianLook(lookOf(look, false), costume);
}

const toolMeshes = new Map<string, MeshData>();

export class Figure {
  readonly look: Look;
  readonly rig: Rig;
  private pieces: InstanceHandle[];
  private extra: InstanceHandle;
  private tool: InstanceHandle | null = null;
  private load: { kind: Load; h: InstanceHandle } | null = null;
  private shown = true;
  private released = false;

  constructor(private stage: LifeStage, lookNumber: number, readonly costume: Barbarian, id: string) {
    this.look = raiderLook(lookNumber, costume);
    this.rig = rigOf(this.look);
    const meshes = buildPerson(this.look, id);
    this.pieces = PIECES.map((p) => stage.spawnMesh(meshes[p], IDENTITY));
    this.extra = stage.spawnMesh(barbarianMesh(this.look, this.rig, costume, id), IDENTITY);
  }

  setVisible(v: boolean): void {
    if (this.released || v === this.shown) return;
    this.shown = v;
    for (const h of this.pieces) h.setVisible(v);
    this.extra.setVisible(v);
    this.tool?.setVisible(v);
    this.load?.h.setVisible(v);
  }

  get visible(): boolean {
    return this.shown && !this.released;
  }

  /**
   * Places the figure: feet at (x, y, z), facing `heading` (0 faces +z), in pose `name` at `phase` (stride
   * phase walking, seconds otherwise). `seat` is the height of a seat above the feet (sitting), else −1.
   * `tweak` adjusts the pose before it is drawn (a rower's arms, a swimmer's reach). `gear` shows the
   * raider's own tool; `load` what they carry.
   */
  pose(x: number, y: number, z: number, heading: number, name: PoseName, phase: number, opts: { seat?: number; tweak?: (p: Pose) => void; gear?: boolean; load?: Load | null; tilt?: number } = {}): void {
    if (this.released) return;
    this.setVisible(true);
    const look = this.look, rig = this.rig;
    const pose = poseOf(name, phase, 0.3);
    opts.tweak?.(pose);
    const load = opts.load ?? null;
    const gear = opts.gear !== false && !load ? raiderGear(this.costume) : null;
    applyHold(pose, rig, { tool: gear, load, hold: load ? HOLD_OF[load] : null, anchor: load ? holdAnchor(load) : null });
    const seat = opts.seat ?? -1;
    rigMatrices(look, pose, local, seat >= 0 ? sitDrop(rig, seat / look.scale) : 0, rig);
    const scale = look.scale;
    const c = Math.cos(heading) * scale, s = Math.sin(heading) * scale;
    const tilt = opts.tilt ?? 0;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let i = 0; i < 5; i++) {
      const k = i * 16;
      for (let col = 0; col < 4; col++) {
        const o = k + col * 4;
        // A tilt forward about the feet (a dive, a swimmer lying in the water), then the heading.
        const lx = local[o]!, ly0 = local[o + 1]!, lz0 = local[o + 2]!;
        const ly = ct * ly0 - st * lz0, lz = st * ly0 + ct * lz0;
        world[o] = c * lx + s * lz + (col === 3 ? x : 0);
        world[o + 1] = scale * ly + (col === 3 ? y : 0);
        world[o + 2] = -s * lx + c * lz + (col === 3 ? z : 0);
        world[o + 3] = col === 3 ? 1 : 0;
      }
    }
    for (let i = 0; i < 5; i++) this.pieces[i]!.setMatrix(world.subarray(i * 16, i * 16 + 16));
    this.extra.setMatrix(world.subarray(0, 16));
    if (gear) {
      if (!this.tool) {
        let m = toolMeshes.get(gear);
        if (!m) toolMeshes.set(gear, (m = toolMesh(gear)));
        this.tool = this.stage.spawnMesh(m, IDENTITY);
      }
      const piece = TOOL_PIECE[gear];
      this.tool.setMatrix(world.subarray(piece * 16, piece * 16 + 16));
    } else if (this.tool) {
      this.tool.release();
      this.tool = null;
    }
    if (this.load && this.load.kind !== load) {
      this.load.h.release();
      this.load = null;
    }
    if (load) {
      this.load ??= { kind: load, h: this.stage.spawnMesh(carriedMesh(load), IDENTITY) };
      const [ax, ay, az] = holdAnchor(load);
      const m = new Array<number>(16);
      for (let i = 0; i < 12; i++) m[i] = world[i]!;
      m[12] = world[0]! * ax + world[4]! * ay + world[8]! * az + world[12]!;
      m[13] = world[1]! * ax + world[5]! * ay + world[9]! * az + world[13]!;
      m[14] = world[2]! * ax + world[6]! * ay + world[10]! * az + world[14]!;
      m[15] = 1;
      this.load.h.setMatrix(m);
    }
  }

  /** The edge of the map cuts it off (as it does the ships): params.w −2. */
  setCut(on: boolean): void {
    if (this.released) return;
    const w = on ? -2 : 0;
    for (const h of [...this.pieces, this.extra, this.tool, this.load?.h]) h?.setParams(1, 0, 0, w);
  }

  release(): void {
    if (this.released) return;
    this.released = true;
    for (const h of this.pieces) h.release();
    this.extra.release();
    this.tool?.release();
    this.load?.h.release();
  }
}

/** A rower's arms on the oar loom: both reaching forward and pulling back with the stroke (0–1). */
export function rowing(stroke: number): (p: Pose) => void {
  const pull = Math.cos(stroke * Math.PI * 2);
  return (p) => {
    p.armL = p.armR = 1.25 + 0.35 * pull;
    p.outL = p.outR = 0.2;
    p.lean = 0.18 * pull;
  };
}
