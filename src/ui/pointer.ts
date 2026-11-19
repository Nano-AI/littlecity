// Real pointer events → the gesture recogniser (./gestures.ts). Owner: Interface.
//
// One adapter for the app's canvas and the gallery's. Pointer Events cover
// the mouse, the trackpad and fingers alike; the wheel covers scrolling and
// the trackpad pinch (which browsers report as a wheel with ctrlKey);
// Safari's own gesture events cover its trackpad pinch.

import { INPUT } from '@/style/input';
import { createGestures, type GestureSink, type PointerSample } from './gestures';

interface SafariGestureEvent extends Event {
  scale: number;
  clientX: number;
  clientY: number;
}

export function attachPointer(canvas: HTMLElement, sink: GestureSink): () => void {
  const gestures = createGestures(sink);
  const off: (() => void)[] = [];
  const on = <T extends Event>(target: EventTarget, type: string, fn: (e: T) => void, opts?: AddEventListenerOptions): void => {
    target.addEventListener(type, fn as EventListener, opts);
    off.push(() => target.removeEventListener(type, fn as EventListener, opts));
  };

  const sample = (e: PointerEvent): PointerSample => {
    const r = canvas.getBoundingClientRect();
    return {
      id: e.pointerId,
      type: e.pointerType === 'mouse' ? 'mouse' : 'touch', // a pen behaves like a finger
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      // Control-click is the Mac's other right click.
      button: e.button === 0 && e.ctrlKey && e.pointerType === 'mouse' ? 2 : e.button,
      shift: e.shiftKey,
      t: e.timeStamp,
    };
  };

  on<PointerEvent>(canvas, 'pointerdown', (e) => {
    if (e.pointerType === 'mouse') e.preventDefault(); // no text selection, no middle-click scroll
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone; the gesture just ends early.
    }
    gestures.down(sample(e));
  });
  on<PointerEvent>(canvas, 'pointermove', (e) => gestures.move(sample(e)));
  on<PointerEvent>(canvas, 'pointerup', (e) => gestures.up(sample(e)));
  on<PointerEvent>(canvas, 'pointercancel', (e) => gestures.cancel(sample(e)));
  on<PointerEvent>(canvas, 'pointerleave', (e) => {
    if (e.pointerType === 'mouse') gestures.leave();
  });
  on(canvas, 'contextmenu', (e) => e.preventDefault());
  on(window, 'blur', () => gestures.reset());

  on<WheelEvent>(
    canvas,
    'wheel',
    (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const pixels = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * r.height : e.deltaY;
      const rate = e.ctrlKey ? INPUT.pinchZoom : INPUT.wheelZoom;
      sink.zoom(Math.exp(-pixels * rate), e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false },
  );

  // Safari on the Mac reports a trackpad pinch as gesture events, not as a wheel.
  let lastScale = 1;
  on<SafariGestureEvent>(canvas, 'gesturestart', (e) => {
    e.preventDefault();
    lastScale = e.scale;
  });
  on<SafariGestureEvent>(canvas, 'gesturechange', (e) => {
    e.preventDefault();
    if (!(e.scale > 0) || !(lastScale > 0)) return;
    const r = canvas.getBoundingClientRect();
    // On a phone the two fingers already arrive as pointers; this path is for the trackpad only.
    if (!('ontouchstart' in window)) sink.zoom(e.scale / lastScale, e.clientX - r.left, e.clientY - r.top);
    lastScale = e.scale;
  });
  on<SafariGestureEvent>(canvas, 'gestureend', (e) => e.preventDefault());

  return () => {
    gestures.reset();
    for (const fn of off) fn();
  };
}
