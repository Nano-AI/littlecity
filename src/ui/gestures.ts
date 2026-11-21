// Reading the pointer (design section 7, "Actions"). Owner: Interface.
//
//   Action          Mouse / trackpad                 Touch
//   use the tool    click (within 5 px)              tap (within 10 px, 250 ms)
//   erase           right click                      long press 450 ms
//   orbit           left drag                        one-finger drag
//   pan             right drag                       two-finger drag
//   zoom            scroll or pinch                  pinch
//   paint a run     Shift + drag                     (not in v1)
//   shape the land  drag (Raise, Dig, Level held)    one-finger drag (Raise, Dig, Level held)
//   pick up, throw  press on it, drag, let go (Hand)  the same, one finger (Hand)
//
// While a land tool is held (sink.dragPaints), a plain drag that starts on
// the land paints a stroke instead of turning the camera: the drag shapes
// the ground, as the tool promises. A drag that starts on the sea or beside
// the island still orbits; Shift-drag paints from anywhere; right drag pans;
// two fingers pan and zoom. A click or tap is still a click.
//
// createGestures() is the recogniser: it is fed plain pointer samples and
// calls a sink with what they mean. It knows nothing about the DOM or the
// town, so it is tested with made-up samples and a made-up clock.
// attachPointer() (./pointer.ts) feeds it from real pointer events.

import { INPUT } from '@/style/input';

export interface PointerSample {
  /** Pointer id: one per finger; the mouse always has the same one. */
  id: number;
  type: 'mouse' | 'touch';
  /** CSS pixels from the canvas's top-left. */
  x: number;
  y: number;
  /** Which button went down or up: 0 left, 1 middle, 2 right. Ignored for touch. */
  button: number;
  shift: boolean;
  /** Milliseconds, from any steady clock (event.timeStamp). */
  t: number;
}

/** What the gestures mean. Positions are CSS pixels from the canvas's top-left. */
export interface GestureSink {
  /** A click or a tap: use the selected tool here. */
  use(x: number, y: number): void;
  /** A right click or a long press: erase here. */
  erase(x: number, y: number): void;
  /** Dragged by this many pixels: turn the camera. */
  orbit(dx: number, dy: number): void;
  /** Dragged by this many pixels: slide the picture. */
  pan(dx: number, dy: number): void;
  /** Zoom by a factor about a point. */
  zoom(factor: number, x: number, y: number): void;
  /**
   * A plain scroll (no Ctrl or ⌘, not a pinch) of `dy` pixels here; `notch`
   * when the wheel reported lines or pages. Return true to take it (it then
   * does not zoom): held length uses it (design section 7).
   */
  scroll?(dy: number, notch: boolean, x: number, y: number): boolean;
  /** The mouse rests here with no button down (never called for touch). */
  hover(x: number, y: number): void;
  /** The mouse left, or started doing something else. */
  hoverEnd(): void;
  /** Shift + press with the mouse. Return false to decline; the drag then orbits as usual. */
  runStart(x: number, y: number): boolean;
  /**
   * True while a plain drag (no Shift; one finger on touch) should paint a run: the land tools. The
   * run starts once the pointer has moved past the click slop, from where it went down.
   */
  dragPaints?(x: number, y: number): boolean;
  runMove(x: number, y: number): void;
  runEnd(): void;
  /** A drag (orbit or pan) began or ended; for the cursor. */
  dragging?(on: boolean): void;
  /**
   * A press (left button, or one finger) here: return true to take it at once as a run (the Mischief
   * drawer's Hand picks up what is under it). The run then follows the pointer until it lifts (runMove,
   * runEnd), even with no movement. Declined, the press is read as usual.
   */
  grab?(x: number, y: number): boolean;
}

/** Timers, so a test can own the clock. */
export interface Scheduler {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const realTimers: Scheduler = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface Gestures {
  down(p: PointerSample): void;
  move(p: PointerSample): void;
  up(p: PointerSample): void;
  /** The system took the pointer away (a call came in, the page scrolled): nothing is used or erased. */
  cancel(p: PointerSample): void;
  /** The mouse left the canvas. */
  leave(): void;
  /** Lets go of everything (the window lost focus). */
  reset(): void;
}

type MouseMode = 'idle' | 'press' | 'orbit' | 'pan' | 'run';
type TouchMode = 'idle' | 'press' | 'orbit' | 'two' | 'spent' | 'run';

interface Finger {
  x: number;
  y: number;
}

export function createGestures(sink: GestureSink, scheduler: Scheduler = realTimers): Gestures {
  // ── mouse ──
  let mouse: MouseMode = 'idle';
  let mouseButton = 0;
  let startX = 0, startY = 0, lastX = 0, lastY = 0;

  // ── touch ──
  let touch: TouchMode = 'idle';
  const fingers = new Map<number, Finger>();
  let pressT = 0;
  let pressTimer: unknown = null;
  let lastCx = 0, lastCy = 0, lastSpread = 0;

  const setDragging = (on: boolean): void => sink.dragging?.(on);

  const cancelPress = (): void => {
    if (pressTimer !== null) scheduler.clear(pressTimer);
    pressTimer = null;
  };

  const twoFingers = (): { cx: number; cy: number; spread: number } => {
    const [a, b] = [...fingers.values()] as [Finger, Finger];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, spread: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  const touchDown = (p: PointerSample): void => {
    fingers.set(p.id, { x: p.x, y: p.y });
    if (fingers.size === 1 && touch === 'idle' && sink.grab?.(p.x, p.y)) {
      startX = lastX = p.x;
      startY = lastY = p.y;
      touch = 'run';
      return;
    }
    if (fingers.size === 1 && touch === 'idle') {
      touch = 'press';
      startX = lastX = p.x;
      startY = lastY = p.y;
      pressT = p.t;
      cancelPress();
      pressTimer = scheduler.set(() => {
        pressTimer = null;
        if (touch !== 'press') return;
        // Held still long enough: erase, and the lift that follows does nothing.
        touch = 'spent';
        sink.erase(startX, startY);
      }, INPUT.longPressMs);
      return;
    }
    cancelPress();
    if (touch === 'run') sink.runEnd();
    if (fingers.size === 2 && touch !== 'spent') {
      if (touch === 'orbit') setDragging(false);
      touch = 'two';
      const g = twoFingers();
      lastCx = g.cx;
      lastCy = g.cy;
      lastSpread = g.spread;
      setDragging(true);
      return;
    }
    // A third finger, or a finger added after the gesture was used up: wait for all of them to lift.
    if (touch === 'two' || touch === 'orbit') setDragging(false);
    touch = 'spent';
  };

  const touchMove = (p: PointerSample): void => {
    const finger = fingers.get(p.id);
    if (!finger) return;
    finger.x = p.x;
    finger.y = p.y;
    if (touch === 'run') {
      sink.runMove(p.x, p.y);
      return;
    }
    if (touch === 'press') {
      if (Math.hypot(p.x - startX, p.y - startY) <= INPUT.tapSlop) return;
      cancelPress();
      if (sink.dragPaints?.(startX, startY) && sink.runStart(startX, startY)) {
        touch = 'run';
        sink.runMove(p.x, p.y);
        return;
      }
      touch = 'orbit';
      lastX = p.x;
      lastY = p.y;
      setDragging(true);
      return;
    }
    if (touch === 'orbit') {
      sink.orbit(p.x - lastX, p.y - lastY);
      lastX = p.x;
      lastY = p.y;
      return;
    }
    if (touch === 'two' && fingers.size === 2) {
      const g = twoFingers();
      if (g.cx !== lastCx || g.cy !== lastCy) sink.pan(g.cx - lastCx, g.cy - lastCy);
      if (lastSpread > 0 && g.spread > 0 && g.spread !== lastSpread) sink.zoom(g.spread / lastSpread, g.cx, g.cy);
      lastCx = g.cx;
      lastCy = g.cy;
      lastSpread = g.spread;
    }
  };

  const touchUp = (p: PointerSample, cancelled: boolean): void => {
    if (!fingers.delete(p.id)) return;
    cancelPress();
    if (touch === 'press') {
      touch = 'idle';
      const quick = p.t - pressT <= INPUT.tapMs;
      const still = Math.hypot(p.x - startX, p.y - startY) <= INPUT.tapSlop;
      if (!cancelled && quick && still) sink.use(startX, startY);
      return;
    }
    if (touch === 'run') sink.runEnd();
    if (touch === 'orbit' || touch === 'two') setDragging(false);
    // After a two-finger gesture the finger that stays down does nothing: no sudden orbit.
    touch = fingers.size === 0 ? 'idle' : 'spent';
  };

  const mouseEnd = (): void => {
    if (mouse === 'orbit' || mouse === 'pan') setDragging(false);
    if (mouse === 'run') sink.runEnd();
    mouse = 'idle';
  };

  return {
    down(p) {
      if (p.type === 'touch') return touchDown(p);
      if (mouse !== 'idle') return; // a second button during a drag changes nothing
      sink.hoverEnd();
      mouseButton = p.button;
      startX = lastX = p.x;
      startY = lastY = p.y;
      mouse = p.button === 0 && ((p.shift && sink.runStart(p.x, p.y)) || (!p.shift && sink.grab?.(p.x, p.y))) ? 'run' : 'press';
    },

    move(p) {
      if (p.type === 'touch') return touchMove(p);
      if (mouse === 'idle') return sink.hover(p.x, p.y);
      if (mouse === 'run') return sink.runMove(p.x, p.y);
      if (mouse === 'press') {
        if (Math.hypot(p.x - startX, p.y - startY) <= INPUT.clickSlop) return;
        if (mouseButton === 0 && sink.dragPaints?.(startX, startY) && sink.runStart(startX, startY)) {
          mouse = 'run';
          sink.runMove(p.x, p.y);
          return;
        }
        mouse = mouseButton === 0 ? 'orbit' : 'pan';
        setDragging(true);
      }
      const dx = p.x - lastX, dy = p.y - lastY;
      lastX = p.x;
      lastY = p.y;
      if (mouse === 'orbit') sink.orbit(dx, dy);
      else sink.pan(dx, dy);
    },

    up(p) {
      if (p.type === 'touch') return touchUp(p, false);
      if (mouse === 'idle' || p.button !== mouseButton) return;
      const clicked = mouse === 'press';
      mouseEnd();
      if (clicked) {
        if (mouseButton === 0) sink.use(startX, startY);
        else if (mouseButton === 2) sink.erase(startX, startY);
      }
      sink.hover(p.x, p.y);
    },

    cancel(p) {
      if (p.type === 'touch') return touchUp(p, true);
      mouseEnd();
    },

    leave() {
      if (mouse === 'idle') sink.hoverEnd();
    },

    reset() {
      cancelPress();
      if (touch === 'run') sink.runEnd();
      if (touch === 'orbit' || touch === 'two') setDragging(false);
      fingers.clear();
      touch = 'idle';
      mouseEnd();
      sink.hoverEnd();
    },
  };
}
