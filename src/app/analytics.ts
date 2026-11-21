// Analytics (PostHog): how many come, who comes back, how long they play, what they do. Owner: Interface.
//
// Off unless the build carries a project key (VITE_POSTHOG_KEY, in .env.production); off in a
// scenario or with ?analytics=off; and off in dev and under automation (browser tests, captures)
// unless the URL says ?analytics=on. PostHog itself loads after the town is on screen; anything tracked before that
// waits in a queue. Nothing here touches the town.
//
// The events (keep this list and the PostHog dashboards in step):
//   town_opened       {how: shared | shared_visiting | saved | new}
//   playtime          {seconds, uses, use_<item>, erased, mischief_<tool>}: every 30 s of play (the tab on
//                     screen and some input in the last 3 minutes), and whatever is left when the tab hides.
//                     uses: clicks that did something with a piece or a land tool (use_<item> says which).
//                     Clicks are tallied into it rather than sent one by one.
//   building_earned   {role, grown}: a kind of building this browser had never seen, appearing after an
//                     edit (grown: a "grow a town" made it, not the player's hand)
//   town_grew         {blocks, grown}: this browser's biggest town passed 10, 25, 50, 100, 250, 500 or 1000 blocks
//   town_shared       {via: link | link_box | file}
//   postcard_saved, town_downloaded, town_file_opened, shared_town_kept, shared_town_left,
//   town_grown {new_island}, new_island, guide_opened, fly_started
// PostHog adds its own: $pageview, $pageleave, clicks on the interface (autocapture), session replays.
//
// A share link carries the whole town in the URL fragment (#t=...): it is cut from every URL sent.

import type { CaptureResult, PostHog } from 'posthog-js';
import type { ShapePlan } from '@/resolve/plan';

type Props = Record<string, string | number | boolean>;

const KEY = (import.meta.env.VITE_POSTHOG_KEY as string | undefined)?.trim();
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined)?.trim() || 'https://us.i.posthog.com';
/** The commit the build came from (tools/deploy-pages.sh sets it), so versions can be compared. */
const BUILD = (import.meta.env.VITE_BUILD as string | undefined) ?? 'dev';

/** Seconds of play per playtime event. */
const PING = 30;
/** No input for this long and the clock stops (someone who walked away from an open tab). */
const IDLE = 180;
const SIZES = [10, 25, 50, 100, 250, 500, 1000];
const ROLES_KEY = 'lc-analytics-roles';
const SIZE_KEY = 'lc-analytics-size';

let on = false;
let ph: PostHog | null = null;
const queue: [string, Props | undefined][] = [];
const tallies = new Map<string, number>();
let growing: () => boolean = () => false;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function remember(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Storage full or refused: it is only forgotten next time.
  }
}

/** Sends an event (or queues it until PostHog has loaded). Does nothing when analytics is off. */
export function track(event: string, props?: Props): void {
  if (!on) return;
  if (ph) ph.capture(event, props);
  else queue.push([event, props]);
}

/** Counts something frequent into the next playtime event instead of sending it on its own. */
export function tally(name: string, n = 1): void {
  if (on) tallies.set(name, (tallies.get(name) ?? 0) + n);
}

/** Lets the town's changes say whether "grow a town" made them. */
export function watchGrowth(isGrowing: () => boolean): void {
  growing = isGrowing;
}

/** Turns analytics on for this page, if it should be. Call once, after the town is set up. */
export function startAnalytics(opts: { scenario: boolean }): void {
  const asked = new URLSearchParams(location.search).get('analytics');
  const automated = (navigator as { webdriver?: boolean }).webdriver === true;
  if (on || !KEY || asked === 'off' || opts.scenario) return;
  // ?analytics=on is how a test or a developer turns it on where it would otherwise stay off.
  if (asked !== 'on' && (automated || !import.meta.env.PROD)) return;
  on = true;
  startClock();
  const load = (): void => {
    import('posthog-js')
      .then(({ default: posthog }) => {
        // A fine pointer is a desktop: the town (a WebGL canvas) goes into replays there, a couple of frames a
        // second. Phones get the interface only, to spare them the work.
        const desktop = window.matchMedia('(pointer: fine)').matches;
        posthog.init(KEY, {
          api_host: HOST,
          defaults: '2026-05-30',
          persistence: 'localStorage',
          person_profiles: 'always',
          respect_dnt: true,
          before_send: scrub,
          // PostHog drops browsers that look automated; a test that asked for analytics wants its events.
          opt_out_useragent_filter: asked === 'on',
          session_recording: {
            maskAllInputs: true,
            ...(desktop ? { captureCanvas: { recordCanvas: true, canvasFps: 2, canvasQuality: '0.4' } } : {}),
          },
        });
        posthog.register({ build: BUILD, touch: !desktop });
        ph = posthog;
        for (const [event, props] of queue.splice(0)) posthog.capture(event, props);
      })
      .catch(() => {
        // Blocked (an ad blocker) or offline: analytics stays off for this page.
        on = false;
        queue.length = 0;
      });
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 4000 });
  else setTimeout(load, 1500);
}

/** Cuts a share link's town out of a URL. */
function cut(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const at = v.indexOf('#t=');
  return at < 0 ? v : v.slice(0, at);
}

/** Every URL in an event without a share link's town (exported for the test). */
export function scrub(r: CaptureResult | null): CaptureResult | null {
  if (!r) return r;
  for (const bag of [r.properties, r.$set, r.$set_once]) {
    if (!bag) continue;
    for (const k of Object.keys(bag)) bag[k] = cut(bag[k]);
  }
  return r;
}

// ── playtime ─────────────────────────────────────────────────────────────
/** Seconds of play not yet sent. */
let played = 0;
let lastInput = 0;
let lastTick = 0;

function startClock(): void {
  lastInput = lastTick = performance.now();
  const touched = (): void => {
    lastInput = performance.now();
  };
  for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel']) window.addEventListener(type, touched, { passive: true, capture: true });
  // The time between ticks, not the number of ticks: a busy page (a slow phone) ticks late. A gap of
  // more than 15 s is a computer that was asleep, and counts as nothing.
  setInterval(() => {
    const now = performance.now();
    const step = (now - lastTick) / 1000;
    lastTick = now;
    if (step > 15 || document.visibilityState !== 'visible' || now - lastInput > IDLE * 1000) return;
    played += step;
    if (played >= PING) ping(false);
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') ping(true);
    else lastTick = performance.now();
  });
  window.addEventListener('pagehide', () => ping(true));
}

function ping(leaving: boolean): void {
  const seconds = Math.round(played);
  if (seconds === 0 && tallies.size === 0) return;
  const props: Props = { seconds, ...Object.fromEntries(tallies) };
  played = 0;
  tallies.clear();
  // Leaving: a beacon, which the browser still sends after the page has gone.
  if (ph) ph.capture('playtime', props, leaving ? { transport: 'sendBeacon' } : undefined);
  else queue.push(['playtime', props]);
}

// ── what the town has come to ────────────────────────────────────────────
let seenRoles: Set<string> | null = null;
let biggest = -1;

/**
 * The town on screen changed. `edited`: an edit changed it (the player's hand, or a growing town), as
 * opposed to a town being opened, an undo or a redo: only an edit counts as earning something.
 */
export function townShown(shape: ShapePlan, edited: boolean): void {
  if (!on) return;
  const store = storage();
  if (seenRoles === null) {
    seenRoles = new Set(store?.getItem(ROLES_KEY)?.split(',').filter(Boolean) ?? []);
    biggest = Number(store?.getItem(SIZE_KEY)) || 0;
  }
  const grown = growing();
  let newRoles = false;
  for (const { role } of shape.roles.values()) {
    if (seenRoles.has(role)) continue;
    seenRoles.add(role);
    newRoles = true;
    if (edited) track('building_earned', { role, grown });
  }
  if (newRoles) remember(ROLES_KEY, [...seenRoles].join(','));
  const blocks = shape.world.blocks.size;
  if (blocks > biggest) {
    if (edited) for (const size of SIZES) if (size > biggest && size <= blocks) track('town_grew', { blocks: size, grown });
    biggest = blocks;
    remember(SIZE_KEY, String(blocks));
  }
}
