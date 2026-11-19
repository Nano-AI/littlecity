// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// The view: the one object the app, the UI, life, the screenshot page and the
// benchmark use to put a town on a canvas. The Look owner implements it in
// src/render/index.ts (`createTownView`); everyone else codes against this.
//
// Who does what with the camera: the VIEW owns the camera's state and maths
// (pose, clamping, projection). The UI owns input: it turns drags, pinches
// and wheel events into orbit / pan / zoomBy calls.

import type { CellKey } from '@/core/grid';
import type { Vec3 } from '@/core/mat4';
import type { LifeStage, Signals } from '@/life/api';
import type { DressingPlan, ShapePlan, StructureId } from '@/resolve/plan';

/** Orthographic orbit camera. Scenario cameras use the same shape. */
export interface CameraPose {
  /** Degrees about the vertical axis. 0 looks north (toward −z); 90 looks west (toward −x). */
  yaw: number;
  /** Degrees above the horizon, clamped to 10–85 so you cannot look from under the island. */
  pitch: number;
  /** 1 fits the whole 48-column map in the view's height; 3 shows a third of it. */
  zoom: number;
  /** The point looked at, in GRID units: [x, level, z] (level is multiplied by CELL_H). */
  target: readonly [number, number, number];
}

export interface Ray {
  /** World space. */
  origin: Vec3;
  /** Unit length. */
  dir: Vec3;
}

/** The ghost preview (design section 7). */
export interface Ghost {
  /** The what-if plan from StagedResolver.preview(). */
  plan: ShapePlan;
  /** Structures of that plan to draw translucent (the new piece, without decorations). */
  show: readonly StructureId[];
  /** Auto neighbours whose resolved kind would change: these shimmer. */
  shimmer?: readonly CellKey[];
  /** An illegal target: drawn as a red outline instead of a piece. */
  refuse?: CellKey;
}

export interface ViewStats {
  drawCalls: number;
  triangles: number;
  /** Milliseconds the last setTown / setDressing spent rebuilding geometry. */
  rebuildMs: number;
}

export interface ViewOptions {
  /** Device pixel ratio cap; default min(devicePixelRatio, 2). */
  pixelRatio?: number;
  /** Keep the drawing buffer readable (screenshots, postcard export). Default false. */
  preserveDrawingBuffer?: boolean;
  /**
   * Added by Look (Stage 1). Where the ink lines are computed: 'full' at the
   * canvas resolution, 'half' at half of it (softer lines, far cheaper; the
   * phone fallback of design section 14). Default 'auto': 'half' on a small
   * touch screen, 'full' elsewhere.
   */
  ink?: 'auto' | 'full' | 'half';
}

export interface TownView {
  readonly canvas: HTMLCanvasElement;
  /** How life moves things. */
  readonly stage: LifeStage;

  /**
   * Shows a town. Rebuilds only what changed (by structure, layer-chunk and
   * prop hash). Pass `dressing: null` right after an edit; the previous
   * props stay until setDressing delivers the new ones.
   */
  setTown(shape: ShapePlan, dressing: DressingPlan | null): void;
  /** Delivers the dressing for the shape last passed to setTown. */
  setDressing(dressing: DressingPlan): void;
  setGhost(ghost: Ghost | null): void;

  getCamera(): CameraPose;
  /** Sets any part of the pose (values are clamped). */
  setCamera(pose: Partial<CameraPose>): void;
  /** Turns the camera by degrees. */
  orbit(dYaw: number, dPitch: number): void;
  /** Slides the target so the picture moves by this many CSS pixels. */
  pan(dxPixels: number, dyPixels: number): void;
  /** Multiplies zoom, keeping the point under (x, y) CSS pixels fixed if given. */
  zoomBy(factor: number, x?: number, y?: number): void;
  /** The world-space ray under a point of the canvas, in CSS pixels from its top-left. */
  screenToRay(x: number, y: number): Ray;
  /** CSS pixel position of a world point. */
  worldToScreen(p: Vec3): [number, number];

  /** Match the canvas's CSS size. Call on window resize. */
  resize(width: number, height: number): void;
  /** Draws one frame. Reads time of day and wind from `signals`; never reads the clock itself. */
  render(signals: Signals): void;
  stats(): ViewStats;
  dispose(): void;
}

/** The signature of `createTownView` in src/render/index.ts. */
export type CreateTownView = (canvas: HTMLCanvasElement, opts?: ViewOptions) => TownView;
