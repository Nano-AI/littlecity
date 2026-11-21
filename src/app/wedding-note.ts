// L57: a small note when a wedding is on ("Wedding bells at the chapel"),
// with Watch, which glides the camera there, and Not now. Once per wedding,
// from the moment the bells ring; it goes by itself when the wedding is
// over. It never stops play: it is one of the cards at the top, like a
// passing message, and nothing waits on it.

import { weddingOn } from '@/life/town/chains/wedding';
import type { Interface } from '@/ui/interface';

export interface WeddingNote {
  /** Once a frame. */
  update(stage: object): void;
  dispose(): void;
}

export function weddingNote(ui: Interface): WeddingNote {
  let shown = -1;
  let close: (() => void) | null = null;
  return {
    update(stage) {
      const w = weddingOn(stage);
      const on = w !== null && w.phase !== 'none' && w.phase !== 'gather';
      if (on && w.held !== shown) {
        shown = w.held;
        close?.();
        close = ui.feedback.banner('Wedding bells at the chapel', [
          {
            label: 'Watch',
            primary: true,
            run: () => {
              close = null;
              const f = weddingOn(stage)?.focus;
              if (f) ui.glideTo([f.x, f.y + 0.3, f.z], 5);
            },
          },
          { label: 'Not now', run: () => void (close = null) },
        ]);
      }
      if (!on && close) {
        close();
        close = null;
      }
    },
    dispose() {
      close?.();
      close = null;
    },
  };
}
