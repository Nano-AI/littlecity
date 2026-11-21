// The town's scenes (L57 the wedding, L63 the beach day, and the ones after):
// the special things a player can stop and watch. One register per board,
// so they share a cadence and the app has one place to look for them.
//
//   cadence   a big scene (one that takes a crowd: the wedding, a beach day,
//             a fair) starts only if fewer than SCENES.most are on and the
//             last big one started SCENES.gap seconds ago or more, and never
//             while another is gathering its people (the wedding, calling its
//             party, comes first). The wedding keeps its own clock and only
//             reports to the register; the others ask it before they begin.
//             Small scenes (a game of conkers, a snowman) do not count.
//   notes     each scene says what to call it, where to look and when it is
//             worth a note; the app shows one note at a time, at most one in
//             SCENES.noteGap seconds (src/app/scene-note.ts).
//
// Pure of the clock: time is the board's life time.

import { SCENES } from '@/style/scenes';
import type { Board } from './board';

export interface Scene {
  /** What kind (the chain's id: 'wedding', 'beach'...), and a number unique to this one in the town. */
  readonly kind: string;
  readonly n: number;
  /** The note's words ("A beach day on the shore"); empty for a scene that takes no note. */
  readonly title: string;
  /** Takes a crowd (counts toward SCENES.most). */
  readonly big: boolean;
  /** Life seconds when it began. */
  readonly began: number;
  /** Where to look now, or null. */
  focus(): { x: number; y: number; z: number } | null;
  /** Worth a note now (the wedding: from the bells; the beach: once the parasols are up). */
  noteworthy(): boolean;
  /** Still calling its people in: other big scenes wait. */
  gathering(): boolean;
  /** Its note comes whatever the note's gap, and before any other (the raid: "Raiders off the coast!"). */
  readonly urgent?: boolean;
}

export interface Scenes {
  /** The scenes going on now. */
  readonly on: readonly Scene[];
  /** May a big scene of this kind begin now? */
  may(kind: string): boolean;
  /** A scene began (returns its number) / ended. */
  begin(scene: Omit<Scene, 'n' | 'began'>): Scene;
  end(scene: Scene): void;
  /** Scenes begun so far, by kind. */
  count(kind: string): number;
}

const byBoard = new WeakMap<object, Scenes>();
const byStage = new WeakMap<object, Scenes>();

/** The register of a board's scenes (made the first time it is asked for). */
export function scenesOf(board: Board): Scenes {
  let s = byBoard.get(board);
  if (!s) {
    s = createScenes(() => board.now);
    byBoard.set(board, s);
  }
  if (board.stage) byStage.set(board.stage, s);
  return s;
}

/** The register of the town drawing on this stage, for the app's note; null before any scene was asked about. */
export function scenesOnStage(stage: object): Scenes | null {
  return byStage.get(stage) ?? null;
}

export function createScenes(now: () => number): Scenes {
  const on: Scene[] = [];
  let lastBig = -Infinity;
  let n = 0;
  const counts = new Map<string, number>();
  return {
    on,
    may(kind) {
      const big = on.filter((s) => s.big);
      if (big.length >= SCENES.most) return false;
      if (on.some((s) => s.kind !== kind && s.gathering())) return false;
      return now() - lastBig >= SCENES.gap;
    },
    begin(scene) {
      const s: Scene = { ...scene, n: ++n, began: now() };
      // (Getters on the given object are kept as they are: copy the functions, which read live state.)
      on.push(s);
      if (s.big) lastBig = now();
      counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
      return s;
    },
    end(scene) {
      const i = on.indexOf(scene);
      if (i >= 0) on.splice(i, 1);
    },
    count: (kind) => counts.get(kind) ?? 0,
  };
}
