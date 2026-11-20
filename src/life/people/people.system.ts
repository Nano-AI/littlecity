// The people system (People, Stage 3): runs the crowd (crowd.ts) and draws
// it. One system for the whole town, because who walks where is a town-wide
// matter (routes, queues, who is home), not one actor's.
//
// Drawing: each person is five rigid pieces (src/parts/people/person.ts)
// spawned on the stage, posed every frame with matrices (pose.ts). Nothing
// is re-meshed while they walk. The `resident` actors the plan places at
// each front door are the same people standing still; this system hides
// those instances and draws its own, so a town shown without life still has
// its residents at their doors.

import { shipInFor } from '../ships/news';
import { DIR4, keyX, keyZ, SEA_Y } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import { defineSystem, type InstanceHandle, type LifeStage, type Signals, type SignalsDriver } from '@/life/api';
import type { MeshData } from '@/gen/mesh';
import { bubbleMesh, kiteMesh, lineMesh, TOOL_PIECE, toolMesh, type Tool } from '@/parts/people/extras';
import { buildPerson, DESIGN_HEIGHT, lookOf, PIECES, rigOf, type Look, type Rig } from '@/parts/people/person';
import { poseOf, rigMatrices, sitDrop } from '@/parts/people/pose';
import type { NavDoor } from '@/resolve/plan';
import { PEOPLE, PERSON } from '@/style/people';
import { obstaclesOf, setCrowd, setDoorTable } from '../doors/table';
import { deferLamp, lightLamp } from '../dusk/lamps.system';
import { easeIn } from '../motion/ease';
import { setOccupied } from '../dusk/occupancy';
import { type Crowd, type Person } from './crowd';
import { createLivingTown, type LivingTown } from '../town';
import { seasonOf, weatherOf } from '../season';
import { restingMesh } from '@/parts/people/loads';
import { place } from '../motion/pose';
import { markCensusReady, recordHome } from './home';
import { carriedMesh, HEAVY, HOLD_OF, holdAnchor } from '@/parts/people/loads';
import type { Load } from './errand';
import { scaresOf } from '../birds/scare';
import { cloudMesh, dazeStarMesh, popMesh, POPS, swearMesh, type PopKind } from '@/parts/people/scuffle-art';
import { rand } from '@/core/rand';
import { LOADS, SCUFFLE } from '@/style/town-life';
import type { Scuffle } from './scuffle';

declare module '@/life/api' {
  interface SignalEvents {
    /** L50: a scuffle started or ended at (x, z). */
    scuffle: { x: number; z: number; what: 'start' | 'end' };
  }
}

/** L50: what is drawn for the scuffle going on (one at a time). */
interface ScuffleArt {
  n: number;
  clouds: InstanceHandle[];
  pops: { kind: PopKind; h: InstanceHandle }[];
  swears: InstanceHandle[];
  stars: InstanceHandle[];
  /** What the two set down before it started, lying beside where they stood. */
  setDown: InstanceHandle[];
  tick: number;
}
const artMeshes: { clouds?: MeshData[]; pops?: Map<PopKind, MeshData>; swears?: MeshData[]; star?: MeshData } = {};
const HIDE: Mat4Like = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -50, 0, 1];

function releaseArt(a: ScuffleArt): void {
  for (const h of a.clouds) h.release();
  for (const p of a.pops) p.h.release();
  for (const h of a.swears) h.release();
  for (const h of a.stars) h.release();
  for (const h of a.setDown) h.release();
}

function spawnArt(stage: LifeStage, n: number, s: Scuffle): ScuffleArt {
  artMeshes.clouds ??= [0, 1, 2].map((v) => cloudMesh(v, SCUFFLE.cloudR, SCUFFLE.cloudH));
  artMeshes.swears ??= [0, 1, 2, 3].map((v) => swearMesh(v));
  artMeshes.star ??= dazeStarMesh();
  if (!artMeshes.pops) {
    artMeshes.pops = new Map();
    for (const k of new Set(POPS)) artMeshes.pops.set(k, popMesh(k));
  }
  const hidden = (m: MeshData): InstanceHandle => {
    const h = stage.spawnMesh(m, HIDE);
    h.setVisible(false);
    return h;
  };
  return {
    n,
    clouds: artMeshes.clouds.map(hidden),
    pops: POPS.map((kind) => ({ kind, h: hidden(artMeshes.pops!.get(kind)!) })),
    swears: artMeshes.swears.map(hidden),
    stars: [0, 1, 2, 3, 4, 5].map(() => hidden(artMeshes.star!)),
    // Set down on the ground a step to the side, away from the cloud.
    setDown: [...s.setDown].map(([p, kind]) => {
      const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz) || 1;
      return stage.spawnMesh(restingMesh(kind), place(p.x + (dx / d) * 0.25 - (dz / d) * 0.15, p.y, p.z + (dz / d) * 0.25 + (dx / d) * 0.15, p.heading));
    }),
    tick: -1,
  };
}

/**
 * Which way the camera looks, to turn the swearing bubble to it: read from the app's debug handle
 * (window.__lc.view), the one place it is known; the default view where there is none (tests, shots).
 */
function cameraAngles(): { yaw: number; pitch: number } {
  const view = (globalThis as { __lc?: { view?: { getCamera?(): { yaw: number; pitch: number } } } }).__lc?.view;
  const c = view?.getCamera?.();
  const deg = Math.PI / 180;
  return c ? { yaw: c.yaw * deg, pitch: c.pitch * deg } : { yaw: 45 * deg, pitch: 35 * deg };
}

/** Poses the scuffle's drawings, on twos (SCUFFLE.drawRate). */
function drawArt(a: ScuffleArt, s: Scuffle, seconds: number): void {
  const tick = Math.floor(seconds * SCUFFLE.drawRate);
  if (tick === a.tick) return;
  a.tick = tick;
  const m = (x: number, y: number, z: number, yaw: number, sc: number, tilt = 0): Mat4Like => {
    const c = Math.cos(yaw), sn = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
    // Ry(yaw) · Rx(−tilt) · S: tilt > 0 turns +Z up toward the sky
    return [c * sc, 0, -sn * sc, 0, -sn * st * sc, ct * sc, -c * st * sc, 0, sn * ct * sc, st * sc, c * ct * sc, 0, x, y, z, 1];
  };
  const fight = s.phase === 'fight';
  // The cloud: one of three heaps at a time, turning; it pops up at the start and bursts at the end.
  const puff = s.phase === 'dazed' && s.t < 0.3;
  const show = fight || puff;
  const k = tick % 3;
  a.clouds.forEach((h, i) => {
    const on = show && i === k;
    h.setVisible(on);
    if (!on) return;
    const grow = Math.min(1, s.age / 0.18);
    let sc = grow < 1 ? 0.4 + grow * 0.75 : 1 + 0.06 * Math.sin(tick * 2.1);
    if (puff) sc = 1.15 + s.t * 1.2;
    const wob = Math.sin(tick * 1.7) * 0.04;
    h.setMatrix(m(s.cx, s.y + (puff ? 0.04 : Math.abs(wob)), s.cz, tick * 0.9 + (s.seed % 10), puff ? sc * 0.7 : sc));
  });
  // Pop-outs: a few at a time round the cloud, a new place every drawing.
  a.pops.forEach((p, i) => {
    const r = (what: string): number => rand(s.seed, 'pop', what, i, tick);
    const on = fight && s.age > 0.25 && s.t < s.fight - 0.2 && r('on') < 0.6;
    p.h.setVisible(on);
    if (!on) return;
    const ang = r('a') * Math.PI * 2;
    const out = SCUFFLE.cloudR * (0.85 + r('o') * 0.35);
    const y = s.y + 0.08 + r('y') * SCUFFLE.cloudH * 0.8;
    const yaw = Math.atan2(Math.cos(ang), Math.sin(ang));
    const tilt = p.kind === 'hat' ? 0.5 + r('t') : p.kind === 'star' ? 0 : (r('t') - 0.5) * 0.8;
    p.h.setMatrix(m(s.cx + Math.cos(ang) * out, y, s.cz + Math.sin(ang) * out, p.kind === 'star' ? tick * 0.7 : yaw, p.kind === 'star' ? 1.8 : 1.7, tilt));
  });
  // The swearing: a new row every SCUFFLE.swear seconds, turned to face the camera.
  const cam = cameraAngles();
  const which = Math.floor(s.age / SCUFFLE.swear) % a.swears.length;
  a.swears.forEach((h, i) => {
    const on = fight && s.age > 0.2 && i === which;
    h.setVisible(on);
    if (on) h.setMatrix(m(s.cx, s.y + SCUFFLE.cloudH + 0.1 + (tick % 2) * 0.015, s.cz, cam.yaw, 1.35, cam.pitch));
  });
  // Stars round the dazed heads.
  const dazed = s.phase === 'dazed' || (s.phase === 'up' && s.t < 0.4);
  a.stars.forEach((h, i) => {
    const who = i < 3 ? s.a : s.b;
    h.setVisible(dazed);
    if (!dazed) return;
    const head = who.y + (s.phase === 'dazed' ? 0.34 : 0.5);
    const ang = tick * 0.55 + (i % 3) * ((Math.PI * 2) / 3) + (i < 3 ? 0 : 1);
    h.setMatrix(m(who.x + Math.cos(ang) * 0.1, head + Math.sin(ang * 2) * 0.012, who.z + Math.sin(ang) * 0.1, -ang, 1));
  });
}

interface Drawn {
  look: Look;
  rig: Rig;
  handles: InstanceHandle[] | null;
  shown: boolean;
  /** What was last sent to the stage, to leave a still figure alone. */
  last: Float32Array;
  /** The chat bubble over their head while they talk. */
  bubble: InstanceHandle | null;
  /** A child's kite and its line (L28). */
  kite: { kite: InstanceHandle; line: InstanceHandle } | null;
  /** What they hold for their work: a broom, a rod, a sack… */
  tool: { kind: Tool; handle: InstanceHandle } | null;
  /** What they carry on an errand (L51 and up). */
  load: { kind: Load; handle: InstanceHandle } | null;
  /** Their everyday look, and the costume the drawing is in now (L57). */
  base: Look;
  costume: Person['costume'];
  /** L50: the hat knocked askew in a scuffle, drawn on its own. */
  askew: InstanceHandle | null;
}

const loadM = new Float32Array(16);
/**
 * How much bigger to draw what people carry, from how far off the camera is: 1 close in (zoom 6 and
 * more), up to LOADS.far from the whole-island view. Read from the app's view (window.__lc), as the
 * scuffle's bubble does; 1 where there is none (tests, shots without the app).
 */
function loadScale(): number {
  const z = (globalThis as { __lc?: { view?: { getCamera?(): { zoom: number } } } }).__lc?.view?.getCamera?.().zoom;
  if (z === undefined) return 1;
  return 1 + (LOADS.far - 1) * Math.max(0, Math.min(1, (6 - z) / (6 - 1.6)));
}

/** L57: a bride in white with her hair up, a groom in a dark coat and top hat. */
export function costumeLook(base: Look, costume: Person['costume']): Look {
  if (costume === 'bride') return { ...base, top: '#fbf8f2', bottom: '#fbf8f2', dress: true, hat: 'none', hairStyle: 'bun', girth: base.girth * 1.08 };
  if (costume === 'groom') return { ...base, top: '#2c2b38', bottom: '#2c2b38', dress: false, hat: 'cap', hatColor: '#24232e' };
  // L50: after a scuffle the hat sits askew (drawn on its own, tipped; see draw()).
  if (costume === 'askew') return { ...base, hat: 'none' };
  return base;
}

/** The tool in a person's hands now, from their pose and their job, or null. */
export function toolOf(p: Person, pose: string): Tool | null {
  if (pose === 'hammer') return 'hammer';
  if (pose === 'mow') return 'scythe';
  if (pose === 'juggle') return Math.floor(p.poseTime * 5) % 2 === 0 ? 'balls-a' : 'balls-b';
  // An errand's load fills their hands (loads.ts draws it).
  if (p.load) return null;
  const job = p.work?.job;
  const atWork = p.mode === 'linger' && p.goal?.haunt?.type === 'workplace';
  if (pose === 'sweep') return 'broom';
  if (pose === 'fish') return 'rod';
  if (pose === 'tend') return 'can';
  if (job === 'lamplighter' && (p.brisk || atWork)) return pose === 'wave' ? 'reach' : 'pole';
  if (pose === 'walk' && p.carrying) return job === 'baker' ? 'tray' : 'sack';
  if (pose === 'carry') return job === 'miller' ? 'sack' : 'tray';
  return null;
}

const toolMeshes = new Map<Tool, MeshData>();

interface State {
  crowd: Crowd;
  /** The crowd with the town's chains on it (L51 and up). */
  town: LivingTown;
  drawn: Map<Person, Drawn>;
  bubbleMesh: MeshData | null;
  lineMesh: MeshData | null;
  /** The plan's own resident instances, kept hidden. */
  standIns: InstanceHandle[];
  /** The drawing last shown (see update), and whether the town changed since, which draws at once. */
  tick: number;
  fresh: boolean;
  unsubscribe: () => void;
  /** L50: the scuffle's drawings, while one is on. */
  art: ScuffleArt | null;
}

const local = new Float32Array(80);
const world = new Float32Array(80);
const IDENTITY: Mat4Like = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** The resident cap for this device (L21): 60, or 30 on a phone-sized viewport. */
export function residentCap(): number {
  const w = (globalThis as { innerWidth?: number }).innerWidth;
  const h = (globalThis as { innerHeight?: number }).innerHeight;
  if (typeof w === 'number' && typeof h === 'number' && Math.min(w, h) < PEOPLE.phoneSide) return PEOPLE.capPhone;
  return PEOPLE.cap;
}

function emit<E extends 'personPassed' | 'residentHome' | 'lampReached' | 'bellRung' | 'scuffle'>(signals: Signals, event: E, payload: Parameters<SignalsDriver['emit']>[1]): void {
  (signals as Partial<SignalsDriver>).emit?.(event, payload as never);
}

function draw(p: Person, d: Drawn, stage: LifeStage, gust: boolean): void {
  // At the water or the map's edge people climb up into view or step down out of it; elsewhere they fade.
  const edge = p.edgeX !== 0 || p.edgeZ !== 0;
  const visible = p.visible && !p.inCloud && p.fade > (edge ? 0.001 : 0.02);
  if (!visible) {
    if (d.shown && d.handles) for (const h of d.handles) h.setVisible(false);
    d.shown = false;
    d.tool?.handle.release();
    d.tool = null;
    d.load?.handle.release();
    d.load = null;
    d.askew?.release();
    d.askew = null;
    return;
  }
  if (d.costume !== p.costume) {
    // L57: dressed for the wedding (or back in everyday clothes): drawn afresh.
    d.costume = p.costume;
    d.look = costumeLook(d.base, p.costume);
    d.rig = rigOf(d.look);
    if (d.handles) for (const h of d.handles) h.release();
    d.handles = null;
  }
  if (!d.handles) {
    // Built the first time they are seen, so a town of sixty does not mesh sixty people in one frame.
    const meshes = buildPerson(d.look, p.id);
    d.handles = PIECES.map((piece) => stage.spawnMesh(meshes[piece], IDENTITY));
    d.shown = true;
  }
  const name = p.react ?? p.pose;
  const walking = name === 'walk' || name === 'run';
  const pose = poseOf(name, walking ? p.stride : p.poseTime, p.rank);
  // L26: a strong gust, and a hand goes to the hat.
  if (gust && d.look.hat !== 'none' && (walking || name === 'stand')) {
    pose.armR = 2.95;
    pose.outR = -0.2;
  }
  const holding = p.load !== null && (walking || name === 'stand' || name === 'carry' || name === 'chat' || name === 'look' || name === 'wave');
  if (holding) {
    // How the load is carried decides the arms (loads.ts); a heavy one bends them forward under it.
    switch (HOLD_OF[p.load!]) {
      case 'side':
        pose.armR = 0.05;
        pose.outR = 0.12;
        break;
      case 'shoulder':
        pose.armR = 2.75;
        pose.outR = -0.15;
        break;
      case 'shoulderL':
        pose.armL = 2.75;
        pose.outL = -0.15;
        break;
      case 'head':
        pose.armL = 2.95;
        pose.outL = 0.25;
        break;
      case 'high':
        pose.armR = 3.05;
        pose.outR = 0.08;
        break;
      case 'yoke':
        pose.armL = pose.armR = 2.3;
        pose.outL = pose.outR = 0.55;
        break;
      case 'push':
        // Both hands down on the handcart's handles.
        pose.armL = pose.armR = 0.75;
        pose.outL = pose.outR = -0.12;
        pose.lean += 0.1;
        break;
      default:
        pose.armL = pose.armR = 1.25;
        pose.outL = pose.outR = -0.2;
    }
    if (walking && HEAVY.has(p.load!)) pose.lean += 0.14;
  } else if (walking && p.carrying) {
    // Arms full: a sack, a tray.
    pose.armL = pose.armR = 1.25;
    pose.outL = pose.outR = -0.2;
  }
  const sitting = name === 'sit' && p.seat >= 0;
  const scale = d.look.scale * (edge ? 1 : 0.35 + 0.65 * p.fade);
  const away = edge ? 1 - p.fade : 0;
  // Down below the water (SEA_Y) by the end, head and all: a step out, then the drop.
  const depth = Math.max(0.5, p.y - SEA_Y + DESIGN_HEIGHT * scale + 0.05);
  const px = p.x + p.edgeX * away, pz = p.z + p.edgeZ * away;
  // The drop comes over the last part of the way: off a dock's end at once, down a beach into the shallows.
  const len = Math.hypot(p.edgeX, p.edgeZ);
  const from = len > 1 ? 0.62 : 0.15;
  const py = p.y + p.lift - depth * easeIn(Math.max(0, Math.min(1, (away - from) / (0.92 - from))));
  rigMatrices(d.look, pose, local, sitting ? sitDrop(d.rig, p.seat / scale) : 0, d.rig);
  // world = T(x, y, z) · Ry(heading) · S(scale) · local
  const c = Math.cos(p.heading) * scale, s = Math.sin(p.heading) * scale;
  for (let i = 0; i < 5; i++) {
    const k = i * 16;
    for (let col = 0; col < 4; col++) {
      const o = k + col * 4;
      const lx = local[o]!, ly = local[o + 1]!, lz = local[o + 2]!;
      world[o] = c * lx + s * lz + (col === 3 ? px : 0);
      world[o + 1] = scale * ly + (col === 3 ? py : 0);
      world[o + 2] = -s * lx + c * lz + (col === 3 ? pz : 0);
      world[o + 3] = col === 3 ? 1 : 0;
    }
  }
  // The tool of their trade, in the hand that holds it.
  const tool = toolOf(p, name);
  if (d.tool && d.tool.kind !== tool) {
    d.tool.handle.release();
    d.tool = null;
  }
  if (tool && !d.tool) {
    let mesh = toolMeshes.get(tool);
    if (!mesh) toolMeshes.set(tool, (mesh = toolMesh(tool)));
    d.tool = { kind: tool, handle: stage.spawnMesh(mesh, world.subarray(TOOL_PIECE[tool] * 16, TOOL_PIECE[tool] * 16 + 16)) };
    d.shown = false; // place it now
  }
  // An errand's load: in the hands, at the body's frame (a scythe off the shoulder and in the hands while mowing).
  const load = name === 'mow' ? null : p.load;
  if (d.load && d.load.kind !== load) {
    d.load.handle.release();
    d.load = null;
  }
  if (load && !d.load) {
    d.load = { kind: load, handle: stage.spawnMesh(carriedMesh(load), world.subarray(0, 16)) };
    d.shown = false;
  }
  // A still figure is left alone: nothing moved, so the page need not redraw its shade.
  let same = d.shown;
  for (let i = 0; same && i < 80; i++) same = d.last[i] === world[i];
  if (!d.shown) {
    for (const h of d.handles) h.setVisible(true);
    d.shown = true;
  }
  if (same) return;
  d.last.set(world);
  for (let i = 0; i < 5; i++) d.handles[i]!.setMatrix(world.subarray(i * 16, i * 16 + 16));
  if (d.tool) d.tool.handle.setMatrix(world.subarray(TOOL_PIECE[d.tool.kind] * 16, TOOL_PIECE[d.tool.kind] * 16 + 16));
  // L50: a hat tipped over one ear after a scuffle.
  const askew = p.costume === 'askew' && d.base.hat !== 'none';
  if (askew && !d.askew) d.askew = stage.spawnMesh(popMesh('hat'), IDENTITY);
  if (!askew && d.askew) {
    d.askew.release();
    d.askew = null;
  }
  if (d.askew) {
    // On the head (the body frame's top, figure units), tipped sideways and a little back.
    const t = 0.55, ct = Math.cos(t), st = Math.sin(t);
    const k = 0.95;
    // body · T(0.03, 0.385, -0.01) · Rz(t) · S(k / scale): the hat is in world units, the body frame in figure units.
    const sc = k / d.look.scale;
    const lx = [ct * sc, st * sc, 0], ly = [-st * sc, ct * sc, 0], lz = [0, 0, sc];
    const m = new Array<number>(16).fill(0);
    for (let c = 0; c < 3; c++) {
      const v = [lx, ly, lz][c]!;
      for (let r = 0; r < 3; r++) m[c * 4 + r] = world[r]! * v[0]! + world[4 + r]! * v[1]! + world[8 + r]! * v[2]!;
    }
    for (let r = 0; r < 3; r++) m[12 + r] = world[r]! * 0.03 + world[4 + r]! * 0.385 + world[8 + r]! * -0.01 + world[12 + r]!;
    m[15] = 1;
    d.askew.setMatrix(m);
  }
  if (d.load) {
    // About its hold anchor, and bigger when the camera is far off (so a sack still reads on a shoulder
    // from the whole-island view; close up it is its own size).
    const [ax, ay, az] = holdAnchor(d.load.kind);
    const k = HOLD_OF[d.load.kind] === 'push' ? 1 : loadScale();
    for (let i = 0; i < 12; i++) loadM[i] = world[i]! * (i % 4 === 3 ? 1 : k);
    loadM[12] = world[0]! * ax + world[4]! * ay + world[8]! * az + world[12]!;
    loadM[13] = world[1]! * ax + world[5]! * ay + world[9]! * az + world[13]!;
    loadM[14] = world[2]! * ax + world[6]! * ay + world[10]! * az + world[14]!;
    loadM[15] = 1;
    d.load.handle.setMatrix(loadM);
  }
}

export default defineSystem<State>({
  id: 'people',
  order: 20,
  create(ctx) {
    const drawn = new Map<Person, Drawn>();
    const doorAt = (door: NavDoor): { x: number; z: number } | null => {
      if (door.socket === undefined || door.dir === undefined) return null;
      const m = ctx.stage.socket(door.socket);
      if (!m) return null;
      // Only a frame that really is at this door's face (a stage with no layout answers with the origin).
      const [dx, dz] = DIR4[door.dir]!;
      const fx = keyX(door.cell) + 0.5 + dx * 0.5, fz = keyZ(door.cell) + 0.5 + dz * 0.5;
      const x = m[12]!, z = m[14]!;
      return Math.abs(x - fx) < 0.8 && Math.abs(z - fz) < 0.8 ? { x, z } : null;
    };
    const town = createLivingTown({
      seed: ctx.seed,
      stage: ctx.stage,
      restingMesh,
      cap: residentCap(),
      doorAt,
      wind: (x, z) => ctx.signals.wind(x, z),
      obstacles: () => obstaclesOf(ctx.stage),
      // L38–L40: the quay draws a crowd while a big ship is in.
      favour: (h) => (shipInFor(ctx.stage, h.id.split('/')[0]!) ? 6 : 0),
      seatAt(socket) {
        const m = ctx.stage.socket(socket);
        if (!m || (m[12] === 0 && m[13] === 0 && m[14] === 0)) return null;
        return { x: m[12]!, y: m[13]!, z: m[14]!, face: Math.atan2(m[8]!, m[10]!) };
      },
      events: {
        home(home, count) {
          recordHome(ctx.signals, home, count);
          emit(ctx.signals, 'residentHome', { home, count });
          // L07, L25: a house's windows light only while somebody is in.
          setOccupied(ctx.stage, home, count > 0);
        },
        passed(cell) {
          emit(ctx.signals, 'personPassed', cell);
        },
        lamp(lamp) {
          emit(ctx.signals, 'lampReached', { lamp });
          lightLamp(ctx.stage, lamp); // L08: it lights as they reach it
        },
        bell(structure) {
          emit(ctx.signals, 'bellRung', structure);
        },
        scuffle(s, what) {
          emit(ctx.signals, 'scuffle', { x: s.x, z: s.z, what });
          // The pigeons round it scatter.
          if (what === 'start') scaresOf(ctx.stage).add(s.cell, 3, false, ctx.signals.time.seconds);
        },
        added(p) {
          const look = lookOf(p.look, p.child);
          drawn.set(p, { look, rig: rigOf(look), handles: null, shown: false, last: new Float32Array(80), bubble: null, kite: null, tool: null, load: null, base: look, costume: null, askew: null });
        },
        removed(p) {
          const d = drawn.get(p);
          if (d?.handles) for (const h of d.handles) h.release();
          d?.bubble?.release();
          d?.kite?.kite.release();
          d?.kite?.line.release();
          d?.tool?.handle.release();
          d?.load?.handle.release();
          d?.askew?.release();
          drawn.delete(p);
        },
      },
    });
    const crowd = town.crowd;
    const offs = [
      ctx.signals.on('blockLanded', (cell) => {
        crowd.blockLanded(cell);
        town.landed(cell); // L54: builders come
      }),
      // Something taken away: those near turn and look too.
      ctx.signals.on('blockRemoved', (cell) => crowd.blockLanded(cell)),
    ];
    const unsubscribe = (): void => offs.forEach((off) => off());
    // L29: the door leaves swing as the crowd's door table says.
    setDoorTable(ctx.stage, crowd.doors);
    setCrowd(ctx.stage, crowd);
    // The debug handle for browser tests and for watching (like the app's window.__lc): the newest crowd.
    (globalThis as { __lcPeople?: Crowd }).__lcPeople = crowd;
    (globalThis as { __lcTown?: LivingTown }).__lcTown = town;
    return { crowd, town, drawn, bubbleMesh: null, lineMesh: null, standIns: [], tick: -1, fresh: true, unsubscribe, art: null };
  },
  sync(state, next, _prev, ctx) {
    if (!next.dressing) {
      // Just after an edit: the town's chains take the new shape now (L54 reads what landed).
      state.town.sync(next.shape, null, ctx.signals.time);
      return;
    }
    state.standIns = [];
    for (const a of next.dressing.actors) {
      if (a.type !== 'resident') continue;
      const h = ctx.stage.instance(a.id);
      if (h) state.standIns.push(h);
    }
    for (const h of state.standIns) h.setVisible(false);
    state.town.sync(next.shape, next.dressing, ctx.signals.time);
    state.fresh = true;
    // The lamps on the lamplighter's round wait for them: each a little longer than the walk to it
    // should take, so a lamp they never reach still lights, in round order.
    const round = state.crowd.jobs.find((j) => j.job === 'lamplighter' && j.worker !== null);
    if (round) round.refs.forEach((lamp, k) => deferLamp(ctx.stage, lamp, PEOPLE.lampWait + k * PEOPLE.lampStep));
    markCensusReady(ctx.signals);
  },
  update(state, dt, signals, ctx) {
    // Whatever else touches the plan's instances (pop-in, a re-sync), the stand-ins stay hidden.
    for (const h of state.standIns) h.setVisible(false);
    state.town.board.setSky(seasonOf(signals), weatherOf(signals));
    state.town.step(dt, signals.time);
    // L50: the scuffle's cloud, its pop-outs, its swearing and the dazed stars.
    const sc = state.crowd.scuffles.now;
    if (state.art && (!sc || sc.n !== state.art.n)) {
      releaseArt(state.art);
      state.art = null;
    }
    if (sc) {
      state.art ??= spawnArt(ctx.stage, sc.n, sc);
      drawArt(state.art, sc, signals.time.seconds);
    }
    // Drawn "on twos": the crowd steps every frame, but the picture of it changes PERSON.drawRate times
    // a second. That is the hand of the thing, and it also spares the page: every frame in which
    // something moved costs the renderer a second pass for the shade on the ground.
    const tick = Math.floor(signals.time.seconds * PERSON.drawRate);
    if (tick === state.tick && !state.fresh) return;
    state.tick = tick;
    state.fresh = false;
    for (const p of state.crowd.people) {
      const d = state.drawn.get(p);
      if (!d) continue;
      const gust = p.visible && d.look.hat !== 'none' && signals.wind(p.x, p.z).strength > PEOPLE.gust;
      draw(p, d, ctx.stage, gust);
      // The chat bubble over whoever is talking (L26).
      const talking = p.bubble && p.visible;
      if (talking) {
        d.bubble ??= ctx.stage.spawnMesh((state.bubbleMesh ??= bubbleMesh()), IDENTITY);
        const m = Array.from(IDENTITY);
        m[12] = p.x;
        m[13] = p.y + (DESIGN_HEIGHT + 0.2) * d.look.scale;
        m[14] = p.z;
        d.bubble.setMatrix(m);
      } else if (d.bubble) {
        d.bubble.release();
        d.bubble = null;
      }
      // A kite (L28): downwind and up, weaving a little; its line from the raised hand.
      if (p.flying && p.visible) {
        if (!d.kite) {
          state.lineMesh ??= lineMesh();
          d.kite = { kite: ctx.stage.spawnMesh(kiteMesh(p.look % 10), IDENTITY), line: ctx.stage.spawnMesh(state.lineMesh, IDENTITY) };
        }
        const wind = signals.wind(p.x, p.z);
        const t = signals.time.seconds;
        const weave = Math.sin(t * 1.3 + p.rank * 20) * 0.2, bob = Math.sin(t * 0.9 + p.rank * 11) * 0.1;
        const pull = Math.min(1.3, 0.7 + wind.strength);
        const kx = p.x + wind.dirX * PEOPLE.kiteOut * pull - wind.dirZ * weave;
        const ky = p.y + PEOPLE.kiteUp + bob;
        const kz = p.z + wind.dirZ * PEOPLE.kiteOut * pull + wind.dirX * weave;
        const hx = p.x + Math.sin(p.heading) * 0.05, hy = p.y + 0.44 * d.look.scale, hz = p.z + Math.cos(p.heading) * 0.05;
        // The kite faces back toward the child, tipped up into the wind.
        const zx = -wind.dirX * 0.8, zy = 0.6, zz = -wind.dirZ * 0.8;
        const xl = Math.hypot(zz, zx) || 1;
        const xx = zz / xl, xz = -zx / xl;
        d.kite.kite.setMatrix([xx, 0, xz, 0, zy * xz, zz * xx - zx * xz, -zy * xx, 0, zx, zy, zz, 0, kx, ky, kz, 1]);
        // The line: its mesh runs one unit along +X, so the X column is the whole span.
        const lx = kx - hx, ly = ky - hy, lz = kz - hz;
        const ll = Math.hypot(lx, ly, lz) || 1;
        const sx = lz / (Math.hypot(lx, lz) || 1), sz = -lx / (Math.hypot(lx, lz) || 1);
        const ux = (-ly * sz) / ll, uy = (sz * lx - sx * lz) / ll, uz = (ly * sx) / ll; // S × L: right-handed
        d.kite.line.setMatrix([lx, ly, lz, 0, ux, uy, uz, 0, sx, 0, sz, 0, hx, hy, hz, 1]);
      } else if (d.kite) {
        d.kite.kite.release();
        d.kite.line.release();
        d.kite = null;
      }
    }
  },
  dispose(state, ctx) {
    state.unsubscribe();
    state.town.dispose();
    if (state.art) releaseArt(state.art);
    state.art = null;
    setDoorTable(ctx.stage, null);
    setCrowd(ctx.stage, null);
    for (const d of state.drawn.values()) {
      if (d.handles) for (const h of d.handles) h.release();
      d.bubble?.release();
      d.kite?.kite.release();
      d.kite?.line.release();
      d.tool?.handle.release();
      d.load?.handle.release();
      d.askew?.release();
    }
    state.drawn.clear();
  },
});

