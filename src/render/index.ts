// STUB (Stage 0). Owner: Look (Stage 1). Final signature: createTownView.
//
// A plain Three.js view that satisfies TownView (./api.ts): one lit,
// vertex-coloured mesh per structure, per layer chunk and per prop, with no
// ink, paper, chunk baking or instancing. The Look owner replaces all of it
// with the spike's renderer; the contract in ./api.ts stays.

import * as THREE from 'three';
import { allChunks, CELL_H, SIZE_X, SIZE_Z, type CellKey } from '@/core/grid';
import { identity, type Mat4Like, type Vec3 } from '@/core/mat4';
import type { GenOutput, PartOutput } from '@/gen/api';
import { allGenerators, allParts } from '@/gen/discover';
import { createLayout, type Layout } from '@/gen/layout';
import type { MeshData } from '@/gen/mesh';
import type { InstanceHandle, LifeStage, Signals, SpawnSpec } from '@/life/api';
import type { Actor, DressingPlan, Prop, ShapePlan, StructureId } from '@/resolve/plan';
import { PALETTE } from '@/style/palette';
import type { CameraPose, Ghost, Ray, TownView, ViewOptions, ViewStats } from './api';

export type { CameraPose, Ghost, Ray, TownView, ViewOptions, ViewStats } from './api';

const SRGB_TO_LINEAR = new Float32Array(256).map((_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

/** MeshData → BufferGeometry (position, normal, linear vertex colour). */
export function toGeometry(mesh: MeshData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(mesh.normal, 3));
  const color = new Float32Array(mesh.color.length);
  for (let i = 0; i < color.length; i++) color[i] = SRGB_TO_LINEAR[mesh.color[i]!]!;
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  return g;
}

interface Drawn {
  hash: number;
  mesh: THREE.Mesh;
  anchors: Record<string, Mat4Like>;
}

const DEG = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function createTownView(canvas: HTMLCanvasElement, opts: ViewOptions = {}): TownView {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
  });
  renderer.setPixelRatio(opts.pixelRatio ?? Math.min(globalThis.devicePixelRatio ?? 1, 2));
  renderer.setClearColor(new THREE.Color(PALETTE.paper));

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9a98f, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(0.35, 1, 0.6);
  scene.add(sun);

  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const ghostMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false });
  const refuseMaterial = new THREE.MeshBasicMaterial({ color: 0xe5484d, wireframe: true });

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  let pose: CameraPose = { yaw: 45, pitch: 35, zoom: 1.6, target: [SIZE_X / 2, 1, SIZE_Z / 2] };
  let width = canvas.clientWidth || canvas.width || 1;
  let height = canvas.clientHeight || canvas.height || 1;

  const structures = new Map<StructureId, Drawn>();
  const layers = new Map<string, Drawn>();
  const items = new Map<string, { hash: number; mesh: THREE.Mesh; base: Mat4Like }>();
  const extras = new Set<THREE.Mesh>();
  const ghostGroup = new THREE.Group();
  scene.add(ghostGroup);

  let shape: ShapePlan | null = null;
  let dressing: DressingPlan | null = null;
  let layout: Layout | null = null;
  let rebuildMs = 0;
  const partOutputs = new Map<string, PartOutput>();

  const addMesh = (data: MeshData, mat: THREE.Material = material): THREE.Mesh => {
    const mesh = new THREE.Mesh(toGeometry(data), mat);
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    return mesh;
  };
  const drop = (mesh: THREE.Mesh): void => {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  };

  const updateCamera = (): void => {
    const yaw = pose.yaw * DEG;
    const pitch = pose.pitch * DEG;
    const target = new THREE.Vector3(pose.target[0], pose.target[1] * CELL_H, pose.target[2]);
    const dir = new THREE.Vector3(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
    camera.position.copy(target).addScaledVector(dir, 200);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    const halfH = SIZE_Z / 2 / pose.zoom;
    const halfW = halfH * (width / height);
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.near = 1;
    camera.far = 600;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  };

  const propOutput = (item: Prop | Actor, category: 'prop' | 'actor', span: number): PartOutput => {
    const k = `${item.id}:${item.hash}:${span.toFixed(3)}`;
    let out = partOutputs.get(k);
    if (!out) {
      const env = { plan: shape!, span };
      out = category === 'prop' ? allParts().prop(item as Prop, env) : allParts().actor(item as Actor, env);
      partOutputs.set(k, out);
    }
    return out;
  };

  const rebuildLayout = (): void => {
    if (!shape) return;
    const anchors = new Map<string, Mat4Like>();
    for (const d of structures.values()) for (const id in d.anchors) anchors.set(id, d.anchors[id]!);
    for (const d of layers.values()) for (const id in d.anchors) anchors.set(id, d.anchors[id]!);
    layout = createLayout({ shape, dressing, anchors, propOutput: (p, span) => propOutput(p, 'prop', span) });
  };

  const syncShape = (next: ShapePlan): void => {
    const generators = allGenerators();
    const parts = allParts();
    const upsert = (map: Map<StructureId, Drawn> | Map<string, Drawn>, k: never, hash: number, build: () => GenOutput): void => {
      const m = map as Map<unknown, Drawn>;
      const old = m.get(k);
      if (old && old.hash === hash) return;
      if (old) drop(old.mesh);
      const out = build();
      m.set(k, { hash, mesh: addMesh(out.mesh), anchors: out.anchors });
    };
    for (const [id, d] of structures) {
      if (!next.structures.has(id)) {
        drop(d.mesh);
        structures.delete(id);
      }
    }
    for (const s of next.structures.values()) {
      upsert(structures, s.id as never, s.hash, () => generators.build(s, next, parts));
    }
    for (const layer of generators.layers()) {
      for (const chunk of allChunks()) {
        const k = `${layer.layer}:${chunk.cx}:${chunk.cz}`;
        upsert(layers, k as never, layer.hash(chunk, next), () => layer.build(chunk, next, parts));
      }
    }
  };

  const syncDressing = (next: DressingPlan): void => {
    const seen = new Set<string>();
    const visit = (item: Prop | Actor, category: 'prop' | 'actor'): void => {
      seen.add(item.id);
      const placed = layout!.item(item.id);
      const base = placed?.frame ?? identity();
      const old = items.get(item.id);
      if (old && old.hash === item.hash) {
        old.base = base;
        old.mesh.matrix.fromArray(base as number[]);
        return;
      }
      if (old) drop(old.mesh);
      const mesh = addMesh(propOutput(item, category, placed?.span ?? 0).mesh);
      mesh.matrix.fromArray(base as number[]);
      mesh.visible = placed !== null || item.at === null;
      items.set(item.id, { hash: item.hash, mesh, base });
    };
    for (const p of next.props) visit(p, 'prop');
    for (const a of next.actors) visit(a, 'actor');
    for (const [id, it] of items) {
      if (seen.has(id)) continue;
      drop(it.mesh);
      items.delete(id);
    }
  };

  const handleFor = (mesh: THREE.Mesh, base: Mat4Like, onRelease: () => void): InstanceHandle => ({
    base,
    setMatrix(m) {
      mesh.matrix.fromArray(m as number[]);
    },
    setVisible(v) {
      mesh.visible = v;
    },
    setParams() {},
    release: onRelease,
  });
  const spawnMesh = (data: MeshData, at: Mat4Like): InstanceHandle => {
    const mesh = addMesh(data);
    mesh.matrix.fromArray(at as number[]);
    extras.add(mesh);
    return handleFor(mesh, at, () => {
      extras.delete(mesh);
      drop(mesh);
    });
  };

  const stage: LifeStage = {
    instance(itemId) {
      const it = items.get(itemId);
      return it ? handleFor(it.mesh, it.base, () => {}) : null;
    },
    spawn(part: SpawnSpec, at) {
      if (!shape) throw new Error('stage.spawn: no town yet');
      const fake = { id: `spawn:${extras.size}`, at: null, rule: 'spawn', hash: 0, variant: part.variant, params: part.params };
      const out =
        'prop' in part
          ? allParts().prop({ ...fake, type: part.prop, at: { cell: 0, pos: 'c' } } as Prop, { plan: shape })
          : allParts().actor({ ...fake, type: part.actor } as Actor, { plan: shape });
      return spawnMesh(out.mesh, at);
    },
    spawnMesh,
    liftStructure(id) {
      const d = structures.get(id);
      if (!d) return null;
      return handleFor(d.mesh, identity(), () => {
        d.mesh.matrix.identity();
      });
    },
    socket(id) {
      return layout?.socket(id) ?? null;
    },
  };

  updateCamera();

  const view: TownView = {
    canvas,
    stage,

    setTown(nextShape, nextDressing) {
      const t0 = performance.now();
      shape = nextShape;
      syncShape(nextShape);
      if (nextDressing) dressing = nextDressing;
      rebuildLayout();
      if (nextDressing) syncDressing(nextDressing);
      rebuildMs = performance.now() - t0;
    },
    setDressing(nextDressing) {
      if (!shape) throw new Error('setDressing before setTown');
      const t0 = performance.now();
      dressing = nextDressing;
      rebuildLayout();
      syncDressing(nextDressing);
      rebuildMs = performance.now() - t0;
    },
    setGhost(ghost: Ghost | null) {
      for (const child of [...ghostGroup.children]) drop(child as THREE.Mesh);
      if (!ghost) return;
      for (const id of ghost.show) {
        const s = ghost.plan.structures.get(id);
        if (!s) continue;
        const mesh = new THREE.Mesh(toGeometry(allGenerators().build(s, ghost.plan, allParts()).mesh), ghostMaterial);
        ghostGroup.add(mesh);
      }
      if (ghost.refuse !== undefined) {
        const c: CellKey = ghost.refuse;
        const box = new THREE.Mesh(new THREE.BoxGeometry(1, CELL_H, 1), refuseMaterial);
        box.position.set((c & 63) + 0.5, ((c >> 12) + 0.5) * CELL_H, ((c >> 6) & 63) + 0.5);
        ghostGroup.add(box);
      }
    },

    getCamera: () => ({ ...pose, target: [...pose.target] as [number, number, number] }),
    setCamera(p) {
      pose = {
        yaw: p.yaw ?? pose.yaw,
        pitch: clamp(p.pitch ?? pose.pitch, 10, 85),
        zoom: clamp(p.zoom ?? pose.zoom, 0.6, 12),
        target: p.target ? [p.target[0], p.target[1], p.target[2]] : pose.target,
      };
      updateCamera();
    },
    orbit(dYaw, dPitch) {
      view.setCamera({ yaw: pose.yaw + dYaw, pitch: pose.pitch + dPitch });
    },
    pan(dx, dy) {
      const perPixel = SIZE_Z / pose.zoom / height;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      // Slide along the ground: project the camera's up onto the horizontal plane.
      const fwd = new THREE.Vector3(up.x, 0, up.z).normalize().multiplyScalar(1 / Math.max(0.2, Math.sin(pose.pitch * DEG)));
      const move = right.multiplyScalar(-dx * perPixel).add(fwd.multiplyScalar(dy * perPixel));
      view.setCamera({ target: [pose.target[0] + move.x, pose.target[1], pose.target[2] + move.z] });
    },
    zoomBy(factor) {
      view.setCamera({ zoom: pose.zoom * factor });
    },
    screenToRay(x, y): Ray {
      const ndc = new THREE.Vector3((x / width) * 2 - 1, -(y / height) * 2 + 1, -1).unproject(camera);
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      return { origin: [ndc.x, ndc.y, ndc.z], dir: [dir.x, dir.y, dir.z] };
    },
    worldToScreen(p: Vec3) {
      const v = new THREE.Vector3(p[0], p[1], p[2]).project(camera);
      return [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height];
    },

    resize(w, h) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      renderer.setSize(width, height, false);
      updateCamera();
    },
    render(signals: Signals) {
      // The only dusk grading the stub does: dim the lights at night.
      sun.intensity = 0.5 + 1.2 * signals.time.light;
      renderer.render(scene, camera);
    },
    stats(): ViewStats {
      return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, rebuildMs };
    },
    dispose() {
      for (const d of structures.values()) drop(d.mesh);
      for (const d of layers.values()) drop(d.mesh);
      for (const it of items.values()) drop(it.mesh);
      for (const m of extras) drop(m);
      renderer.dispose();
    },
  };
  return view;
}
