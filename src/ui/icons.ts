// Every picture in the interface, drawn here as inline SVG in the game's
// own style: an ink outline, flat pastel fills from the palette, and lines
// that are never quite straight. Owner: Interface.
//
// One icon per tray piece (the id is the piece's kind), one per tool, and
// the handful the top bar and the menu need. icon(id) returns SVG markup; an
// id with no drawing gets a plain box, so a new kind still shows up in the
// tray before anyone has drawn it.

import { houseStyle, styleAccent, styleRoof } from '@/style/houses';
import { PALETTE, RAMPS } from '@/style/palette';

const C = {
  ink: PALETTE.ink,
  wall: RAMPS.wall[0]!,
  roof: RAMPS.roof[0]!,
  roofBlue: RAMPS.roof[1]!,
  orange: RAMPS.roof[2]!,
  stone: PALETTE.stone,
  stoneShade: PALETTE.stoneShade,
  stoneLine: '#b9ae9e',
  wood: PALETTE.wood,
  woodDark: RAMPS.wood[3]!,
  leaf: PALETTE.leaf,
  leafDark: PALETTE.leafDark,
  trunk: PALETTE.trunk,
  red: PALETTE.red,
  redDark: PALETTE.redDark,
  brick: PALETTE.brick,
  white: PALETTE.white,
  glass: PALETTE.glass,
  magic: PALETTE.magic,
  magicLight: '#ddd0ff',
  magicDark: '#b3a0f0',
  magicInk: '#7a62c9',
  yellow: PALETTE.yellow,
  moon: '#fff1bd',
  sea: PALETTE.sea,
  shallow: PALETTE.shallow,
  seaInk: '#5f8fc4',
  path: PALETTE.path,
  plaza: PALETTE.plaza,
  garden: PALETTE.garden,
  grass: PALETTE.grass,
  dirt: PALETTE.dirt,
  dirtDark: PALETTE.dirtDark,
  pink: PALETTE.pink,
  sand: PALETTE.sand,
  metal: '#d9d4cc',
};

/** A four-pointed sparkle centred on (cx, cy). */
function sparkle(cx: number, cy: number, r: number, attrs = `fill="${C.yellow}"`): string {
  const k = r * 0.14;
  const f = (n: number): string => n.toFixed(1);
  return (
    `<path ${attrs} d="M${f(cx)} ${f(cy - r)} Q${f(cx + k)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} ` +
    `Q${f(cx + k)} ${f(cy + k)} ${f(cx)} ${f(cy + r)} Q${f(cx - k)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} ` +
    `Q${f(cx - k)} ${f(cy - k)} ${f(cx)} ${f(cy - r)} Z"/>`
  );
}

/** A sun: a disc with short rays, a little uneven. */
function sun(cx: number, cy: number, r: number, fill: string = C.yellow, rays = 8): string {
  let d = '';
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + 0.2;
    const r0 = r + 2.6, r1 = r + (i % 2 === 0 ? 6.4 : 5.4);
    d += `M${(cx + Math.cos(a) * r0).toFixed(1)} ${(cy + Math.sin(a) * r0).toFixed(1)} L${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)} `;
  }
  return `<path d="${d}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
}

const CUBE_TOP = 'M24 7.6 L40.4 15.8 L24.2 24.2 L7.8 16 Z';
const CUBE_LEFT = 'M7.8 16 L24.2 24.2 L24 42 L8 33.6 Z';
const CUBE_RIGHT = 'M24.2 24.2 L40.4 15.8 L40.2 33.8 L24 42 Z';

/** A small square of ground seen from the game's angle, for the three floors. */
function tile(top: string, detail: string): string {
  return (
    `<path d="M4.2 24 L24 35.8 L24 40.6 L4.3 28.6 Z" fill="${C.dirt}"/>` +
    `<path d="M24 35.8 L43.8 24 L43.8 28.5 L24 40.6 Z" fill="${C.dirtDark}"/>` +
    `<path d="M24.1 12 L43.8 24 L24 35.8 L4.2 24 Z" fill="${top}"/>` +
    detail
  );
}

const thin = 'stroke-width="1.2"';
const picket = (x: number): string =>
  `<path d="M${x} 40.6 L${x + 0.1} 17.8 L${x + 2.9} 13.4 L${x + 5.7} 17.7 L${x + 5.8} 40.5 Z" fill="${C.white}"/>`;

const DRAWINGS: Record<string, string> = {
  // ── pieces ───────────────────────────────────────────────────────────
  auto:
    `<g stroke="${C.magicInk}" stroke-dasharray="3.6 3.2">` +
    `<path d="${CUBE_LEFT}" fill="${C.magic}"/><path d="${CUBE_RIGHT}" fill="${C.magicDark}"/><path d="${CUBE_TOP}" fill="${C.magicLight}"/></g>` +
    sparkle(24, 25, 9.5) +
    sparkle(38.4, 8.6, 4.2, `fill="${C.white}" stroke-width="1.6"`),

  house:
    `<path d="M30.5 9.4 L30.8 19 L35.6 19.2 L35.4 9.2 Z" fill="${C.redDark}"/>` +
    `<path d="M10.4 23.6 L10.8 40.7 L37.5 40.3 L37.8 23.4 Z" fill="${C.wall}"/>` +
    `<path d="M6.3 24.6 L23.7 8.6 L41.8 24.2 Z" fill="${C.roof}"/>` +
    `<path d="M15.6 40.6 L15.8 31 Q19 28.6 22.1 30.9 L22.3 40.5" fill="${C.roofBlue}"/>` +
    `<rect x="27.4" y="28.8" width="6.2" height="6" rx="0.7" fill="${C.white}"/>` +
    `<path ${thin} d="M30.5 29 L30.5 34.6 M27.6 31.8 L33.4 31.8"/>` +
    `<circle cx="23.9" cy="18.2" r="2.4" fill="${C.white}"/>`,

  tower:
    `<path d="M24.1 6 L24.1 2.2"/><path d="M24.1 2.1 L29 3.5 L24.1 5" fill="${C.red}" stroke-width="1.5"/>` +
    `<path d="M16.4 41 L17.2 19 L30.8 19.2 L31.7 40.8 Z" fill="${C.stone}"/>` +
    `<path d="M13 20.4 L24.1 6 L35.1 20.1 Z" fill="${C.roofBlue}"/>` +
    `<path d="M22.2 30.2 L22.3 26.4 Q24 24.4 25.7 26.4 L25.8 30.2 Z" fill="${C.glass}"/>` +
    `<path d="M21.5 40.8 L21.6 36.6 Q24 34.2 26.5 36.5 L26.6 40.8" fill="${C.wood}"/>` +
    `<path ${thin} stroke="${C.stoneLine}" d="M18.4 24 L21.6 24.1 M27.4 33 L30.4 33.1 M18 35.6 L20.2 35.6 M27 23.6 L29.6 23.6"/>`,

  lighthouse:
    `<path ${thin} d="M31.4 12.6 L38.6 10.2 M31.6 15 L38.8 17 M16.8 12.6 L9.6 10.2 M16.6 15 L9.4 17"/>` +
    `<path d="M16.8 41.2 L20.2 17.4 L27.9 17.3 L31.4 41 Z" fill="${C.white}"/>` +
    `<path stroke-width="1.4" d="M19.5 22 L28.6 22 L29.4 27.5 L18.8 27.5 Z" fill="${C.red}"/>` +
    `<path stroke-width="1.4" d="M18 33 L30.2 33 L31 38.5 L17.2 38.5 Z" fill="${C.red}"/>` +
    `<path d="M20.7 17.2 L20.9 11.2 L27.3 11.2 L27.4 17.2 Z" fill="${C.yellow}"/>` +
    `<path stroke-width="2.6" d="M18 17.5 L30.2 17.3"/>` +
    `<path d="M19 11.5 L24.1 5.4 L29.2 11.3 Z" fill="${C.red}"/>`,

  arch:
    `<path d="M7.6 40.8 L7.9 15.6 L40.3 15.2 L40.5 40.6 L31.6 40.7 L31.5 31 A7.6 7.6 0 0 0 16.4 31.2 L16.5 40.8 Z" fill="${C.stone}"/>` +
    `<path d="M5.8 15.8 L6 11.2 L42.2 10.8 L42.3 15.4 Z" fill="${C.stoneShade}"/>` +
    `<path ${thin} stroke="${C.stoneLine}" d="M24 23.2 L24 19.6 M18.4 25.4 L16.2 22.8 M29.6 25.4 L31.8 22.8 M9.4 21.6 L13 21.6 M35.4 21.4 L39 21.4 M9.2 30 L12.4 30 M35.8 29.8 L39.2 29.8 M10 36 L12.8 36"/>`,

  dock:
    `<path stroke-width="2.6" d="M12.4 27 L12.6 39.4 M36.2 27 L36.4 38.6 M19.4 21 L19.5 24"/>` +
    `<path d="M10.6 27.4 L42.6 23.4 L42.7 26.6 L10.8 30.8 Z" fill="${C.woodDark}"/>` +
    `<path d="M5.6 20.6 L37 17.6 L42.6 23.4 L10.6 27.4 Z" fill="${C.wood}"/>` +
    `<path ${thin} d="M13.4 19.9 L18.6 26.4 M21.2 19.1 L26.6 25.4 M29 18.4 L34.6 24.4"/>` +
    `<path stroke="${C.seaInk}" d="M3.6 39.4 q3.2 -3 6.4 0 t6.4 0 t6.4 0 t6.4 0 t6.4 0 t6.4 0 M10 44.2 q3 -2.6 6 0 t6 0 t6 0 t6 0"/>`,

  marble:
    `<path d="${CUBE_LEFT}" fill="${C.stone}"/><path d="${CUBE_RIGHT}" fill="${C.stoneShade}"/><path d="${CUBE_TOP}" fill="${PALETTE.marble}"/>` +
    `<path ${thin} stroke="${C.stoneLine}" d="M11.6 22.4 Q15.4 26 13.6 31.4 M17 28 Q19 30 18.4 33.6 M29.6 27 Q33 28.4 35.2 23.6 M17.6 13.6 Q22 16 27.6 13.4"/>`,

  pillar:
    `<path d="M13.4 42 L13.6 37.8 L34.4 37.6 L34.6 41.8 Z" fill="${C.stoneShade}"/>` +
    `<path d="M17.6 37.8 L18.5 14 L29.6 13.9 L30.5 37.7 Z" fill="${C.stone}"/>` +
    `<path d="M13.8 14.2 L14 9.4 L34 9.2 L34.2 14 Z" fill="${C.stoneShade}"/>` +
    `<path ${thin} stroke="${C.stoneLine}" d="M21.7 17.4 L21.3 34.6 M24.1 17.4 L24 34.6 M26.5 17.4 L26.9 34.6"/>`,

  stairs:
    `<path d="M7.6 42 L7.8 33.8 L17.6 33.6 L17.8 25.6 L27.6 25.4 L27.8 17.4 L39.8 17.2 L40 41.8 Z" fill="${C.stone}"/>` +
    `<path ${thin} stroke="${C.stoneLine}" d="M17.8 34.4 L17.8 41.4 M27.8 26.2 L27.8 41.4 M9 37.8 L16.4 37.7 M19.2 29.6 L26.4 29.5 M29.4 21.4 L38.6 21.3"/>`,

  windmill:
    `<path d="M17.2 42 L20.6 21.6 L27.6 21.5 L31 41.8 Z" fill="${C.brick}"/>` +
    `<path d="M19.4 21.9 Q24 13.2 28.8 21.7 Z" fill="${C.redDark}"/>` +
    `<path d="M22.2 41.8 L22.3 36.6 Q24.1 34.6 25.9 36.6 L26 41.8" fill="${C.wood}"/>` +
    `<g stroke-width="1.6" fill="${C.white}">` +
    `<path d="M26.2 17.3 L36.1 7.4 L39.4 10.6 L29.5 20.5 Z"/><path d="M26.2 21.5 L36.1 31.4 L32.9 34.7 L23 24.8 Z"/>` +
    `<path d="M22 21.5 L12.1 31.4 L8.8 28.2 L18.7 18.3 Z"/><path d="M22 17.3 L12.1 7.4 L15.3 4.1 L25.2 14 Z"/></g>` +
    `<circle cx="24.1" cy="19.4" r="2.3" fill="${C.yellow}"/>`,

  tree:
    `<path d="M21.8 42 L22.2 29 L26 29 L26.4 42 Z" fill="${C.trunk}"/>` +
    `<path d="M12 22 Q9.6 13 18 10 Q24 3.6 31 8.6 Q39.4 11.6 37 21 Q39.4 29 30.4 31.2 Q24 35.4 17 31.2 Q9.6 29 12 22 Z" fill="${C.leaf}"/>` +
    `<path ${thin} stroke="${C.leafDark}" d="M17 25.6 Q21.6 29.6 27.6 27.6 M27 13.4 Q31.4 15 31.8 19.4"/>`,

  fountain:
    `<path stroke="${C.seaInk}" d="M24 22 L24.1 9.2 M24 11 Q17.4 9.2 15.6 17.6 M24.1 11 Q30.8 9.2 32.5 17.6"/>` +
    `<path d="M7.6 31.4 Q8.4 41.8 24 41.8 Q39.6 41.8 40.4 31.2 Z" fill="${C.stone}"/>` +
    `<ellipse cx="24" cy="31.3" rx="16.4" ry="4.4" fill="${C.shallow}"/>` +
    `<path d="M21.6 31.6 L21.9 23 L26.2 23 L26.5 31.6" fill="${C.stone}"/>` +
    `<ellipse cx="24" cy="22.4" rx="6.6" ry="2.3" fill="${C.shallow}"/>`,

  stall:
    `<path d="M11 19 L11.2 31 M37 19 L36.8 31"/>` +
    `<path d="M8.6 30.4 L8.8 41 L39.2 40.8 L39.4 30.2 Z" fill="${C.wood}"/>` +
    `<g stroke-width="1.4"><circle cx="15.6" cy="28" r="2.5" fill="${C.yellow}"/><circle cx="21.4" cy="28.1" r="2.5" fill="${C.red}"/>` +
    `<circle cx="27.4" cy="28" r="2.5" fill="${C.pink}"/><circle cx="33" cy="28" r="2.5" fill="${C.leaf}"/></g>` +
    `<path d="M5.4 20 L9.6 8.8 L38.6 8.6 L42.6 19.8 Q39.6 23.4 36.4 19.9 Q33.3 23.4 30.2 19.9 Q27.1 23.4 24 20 Q20.9 23.4 17.8 20 Q14.7 23.4 11.6 20 Q8.5 23.4 5.4 20 Z" fill="${C.white}"/>` +
    `<g stroke-width="1.3" fill="${C.red}"><path d="M9.6 8.8 L14.4 8.8 L11.6 20 Q8.5 23.4 5.4 20 Z"/>` +
    `<path d="M19.3 8.7 L24.1 8.7 L24 20 Q20.9 23.4 17.8 20 Z"/><path d="M28.9 8.7 L33.8 8.6 L36.4 19.9 Q33.3 23.4 30.2 19.9 Z"/></g>`,

  fence:
    `<path d="M4.6 23 L43.4 22.6 L43.5 26 L4.7 26.4 Z" fill="${C.white}"/><path d="M4.6 32.4 L43.4 32 L43.5 35.4 L4.7 35.8 Z" fill="${C.white}"/>` +
    picket(7.4) + picket(16.6) + picket(25.8) + picket(35) +
    `<path ${thin} stroke="${C.leafDark}" d="M3.6 43.4 L5 41 M13.8 43.6 L14.6 41.4 M23.4 43.6 L24 41.6 M32.6 43.6 L33.6 41.4 M43 43.4 L44 41.2"/>`,

  wall:
    `<path d="M6.4 40.6 L6.6 24.6 L41.4 24.2 L41.6 40.4 Z" fill="${C.stone}"/>` +
    `<path d="M4.4 24.8 L4.6 19.6 L43.4 19.2 L43.6 24.4 Z" fill="${C.stoneShade}"/>` +
    `<path ${thin} stroke="${C.stoneLine}" d="M7 30 L41.2 29.8 M7 35.2 L41.2 35 M15 25 L15 29.8 M27 25 L27 29.8 M36 24.8 L36 29.8 M10.4 30.2 L10.4 35 M21 30 L21 35 M32 30 L32 35 M16 35.4 L16 40.2 M27.6 35.2 L27.6 40.2 M37 35.2 L37 40.2"/>`,

  path: tile(
    C.grass,
    `<path stroke-width="1.4" d="M10.6 28 Q19.6 26.4 23.6 22 Q27.4 17.8 30.8 16 L37.6 19.9 Q31.4 22.6 27.8 26.6 Q23.6 30.6 17.4 32 Z" fill="${C.path}"/>` +
      `<path ${thin} stroke="${C.leafDark}" d="M12 22.4 L12.6 20.6 M17.6 19 L18.2 17.2 M31 29.4 L31.6 27.6 M36 26 L36.6 24.4"/>`,
  ),

  plaza: tile(
    C.plaza,
    `<path ${thin} stroke="${C.stoneLine}" d="M10.8 27.9 L30.6 16 M17.4 31.9 L37.2 20 M10.8 20 L30.6 31.9 M17.4 16 L37.2 27.9"/>`,
  ),

  garden: tile(
    C.garden,
    `<path ${thin} stroke="${C.leafDark}" d="M12.4 24.8 L13 23 M26.6 16.8 L27.2 15.2 M27.6 31.4 L28.2 29.8 M36.6 24.6 L37.2 23"/>` +
      `<g stroke-width="1.2"><circle cx="17" cy="22.6" r="2.1" fill="${C.pink}"/><circle cx="22.6" cy="18.8" r="2.1" fill="${C.yellow}"/>` +
      `<circle cx="24" cy="26.6" r="2.1" fill="${C.red}"/><circle cx="30.4" cy="22.2" r="2.1" fill="${C.white}"/>` +
      `<circle cx="31.6" cy="27.6" r="2.1" fill="${C.pink}"/><circle cx="18.6" cy="28.6" r="2.1" fill="${C.yellow}"/></g>`,
  ),

  // ── tools ────────────────────────────────────────────────────────────
  change:
    `<g stroke-width="2.4"><path d="M11.4 21.4 A13 13 0 0 1 35.6 16.6"/><path d="M36.2 9.4 L35.8 17 L28.4 15.8"/>` +
    `<path d="M36.6 26.6 A13 13 0 0 1 12.4 31.4"/><path d="M11.8 38.6 L12.2 31 L19.6 32.2"/></g>` +
    sparkle(24, 24, 6.4, `fill="${C.yellow}" stroke-width="1.6"`),

  paint:
    `<path d="M33.4 5.8 L39.6 11.4 L26.6 26.4 L21.2 21.2 Z" fill="${C.wood}"/>` +
    `<path d="M21.2 21.2 L26.6 26.4 L23.4 29.6 L18 24.4 Z" fill="${C.metal}"/>` +
    `<path d="M18 24.4 L23.4 29.6 Q22.6 37.6 12.4 39.6 Q8.6 40.2 9.2 36.6 Q13 34 12.4 29.6 Q13 25 18 24.4 Z" fill="${C.pink}"/>` +
    `<path d="M33 37.4 Q35.4 33.4 37.6 37.2 Q38.4 40.6 35.2 40.8 Q32.2 40.6 33 37.4 Z" fill="${C.pink}" stroke-width="1.5"/>`,

  erase:
    `<path d="M14 27.8 L21.2 18.6 L33.4 27.6 L26.2 37 Z" fill="${C.pink}"/>` +
    `<path d="M21.2 18.6 L28.2 9.6 L40.4 18.6 L33.4 27.6 Z" fill="${C.white}"/>` +
    `<path d="M7.6 41.6 L31.4 41.4"/><path ${thin} d="M34.6 41.4 L37 41.4 M9.4 36.6 L11.4 37.6 M6.8 33 L8.6 34"/>`,

  // ── mischief (design section 13b) ────────────────────────────────────
  torch:
    `<path d="M14.6 41.4 L25.4 24.6 L28.6 26.6 L17.8 43.4 Z" fill="${C.wood}"/>` +
    `<path d="M24.2 23.4 L30.2 27.2 L31.8 24.6 L25.8 20.8 Z" fill="${C.woodDark}"/>` +
    `<path d="M26.4 21.2 Q21.6 15.4 26.8 9.8 Q27 13.6 29.8 14.6 Q30.2 8.6 34.4 5.2 Q33.4 10.8 37.4 13.6 Q40.2 19.4 33.6 24.2 Z" fill="${C.orange}"/>` +
    `<path ${thin} d="M29 20.6 Q27.4 17.4 29.8 15.8 Q31 18 32.4 17.2 Q32.6 14.2 34.6 12.6 Q35 17.6 36 18.6 Q35.6 21.6 32.8 22.4 Z" fill="${C.yellow}"/>`,

  bomb:
    `<circle cx="21.6" cy="28.4" r="12.6" fill="${PALETTE.metal}"/>` +
    `<path d="M27.8 15.6 L31.4 13 L34.2 16.6 L30.8 19.4 Z" fill="${PALETTE.metal}"/>` +
    `<path stroke-width="2" d="M32.8 14.8 Q35.4 9.4 39.6 10.6"/>` +
    `<path ${thin} d="M15 24 Q16.2 20.6 19.4 19.6" stroke="${C.white}"/>` +
    sparkle(40.6, 8.6, 4.6, `fill="${C.yellow}" stroke-width="1.4"`),

  mallet:
    `<path d="M22.6 24.2 L36.6 38.4 L33.6 41.4 L19.6 27.2 Z" fill="${C.wood}"/>` +
    `<path d="M9.4 18.4 L20.8 7 L30.2 16.4 L18.8 27.8 Z" fill="${C.woodDark}"/>` +
    `<path ${thin} d="M12.6 21.4 L23.8 10.2 M16 24.6 L27 13.6"/>` +
    `<path ${thin} d="M37.6 27.6 L41.6 25.6 M36.4 23.4 L38.8 19.8 M40.6 32 L44.4 31.6"/>`,

  mend:
    `<path d="M8.8 33.6 L24.8 33.4 L24.8 41.6 L8.8 41.8 Z" fill="${C.brick}"/>` +
    `<path ${thin} d="M16.8 33.6 L16.8 41.6"/>` +
    `<path d="M22.8 27.6 L37.6 12.8 L41.4 21.4 Z" fill="${C.metal}"/>` +
    `<path d="M22.8 27.6 L18.4 24 L14.2 28.4" stroke-width="2.2"/>` +
    `<path d="M14.6 28 L11.2 31.4 L13.4 33.2 L16.6 30 Z" fill="${C.wood}"/>`,

  // ── top bar ──────────────────────────────────────────────────────────
  menu: `<path stroke-width="3" d="M10 15 Q24 13.2 38 15.4 M10 24.6 Q24 23.2 38 24 M10 33 Q24 34.6 38 33.2"/>`,
  undo: `<path stroke-width="2.6" d="M17.4 13.4 L8.8 21 L17.8 28.4"/><path stroke-width="2.6" d="M9.6 21 L28 20.8 Q38.6 21.4 38.6 29.6 Q38.4 37.2 29 37.2 L21.6 37.2"/>`,
  redo: `<path stroke-width="2.6" d="M30.6 13.4 L39.2 21 L30.2 28.4"/><path stroke-width="2.6" d="M38.4 21 L20 20.8 Q9.4 21.4 9.4 29.6 Q9.6 37.2 19 37.2 L26.4 37.2"/>`,
  // The guide: an open sketchbook, a little house drawn on its right page, a ribbon to keep the place.
  guide:
    `<path d="M4.6 16.4 L4.8 39.6 Q14.4 36.8 24 41 Q33.6 36.8 43.2 39.4 L43.2 16.2" fill="${C.roof}"/>` +
    `<path d="M6.6 12.4 Q15.6 9.6 24 13.8 L24.1 38.2 Q15.4 34.4 6.8 36.6 Z" fill="${C.white}"/>` +
    `<path d="M24 13.8 Q32.4 9.4 41.4 12 L41.2 36.2 Q32.6 34 24.1 38.2 Z" fill="${C.white}"/>` +
    `<path ${thin} d="M10.2 18 Q14.8 16.6 20.2 18.4 M10.2 22.6 Q14.8 21.2 20.2 23 M10.2 27.2 Q14 26 18 27.4"/>` +
    `<path stroke-width="1.5" d="M28.4 31.4 L28.5 24.8 L32.8 20.6 L37 24.6 L37 31 Z" fill="${C.pink}"/>` +
    `<path ${thin} d="M31.6 31.2 L31.6 27.8 L34 27.8 L34 31.1"/>` +
    `<path stroke-width="1.5" d="M29.8 11.6 L29.9 4.8 L33.4 4.6 L33.4 10.8 L31.6 9.4 Z" fill="${C.red}"/>`,
  // A small tick in a ring: an entry of the guide the town already holds.
  tick: `<circle cx="24" cy="24" r="17.5" fill="${C.leaf}"/><path stroke-width="3.6" d="M15.2 24.6 L21.6 31 L33.4 17.4" stroke="${C.ink}"/>`,
  'time-run':
    sun(17.5, 17.5, 6.6) +
    `<path d="M33.6 21.6 A10.4 10.4 0 1 0 41 37.4 A8.4 8.4 0 0 1 33.6 21.6 Z" fill="${C.moon}"/>`,
  'time-day': sun(24, 24, 8.6),
  'time-dusk':
    `<path d="M11.2 15.6 L13.6 18.4 M24 9.6 L24 13.4 M36.8 15.6 L34.4 18.4 M6.6 26 L10 26.8 M41.4 26 L38 26.8"/>` +
    `<path d="M13.4 31.6 A10.6 10.6 0 0 1 34.6 31.6 Z" fill="${C.orange}"/>` +
    `<path d="M5.6 31.6 L42.4 31.4"/><path ${thin} d="M12 36.6 L24 36.4 M28 36.6 L36 36.4 M18 40.8 L31 40.6"/>`,
  'time-night':
    `<path d="M28.6 7.6 A15.4 15.4 0 1 0 40.6 31.4 A12.6 12.6 0 0 1 28.6 7.6 Z" fill="${C.moon}"/>` +
    sparkle(37, 13, 4.4, `fill="${C.white}" stroke-width="1.5"`) +
    sparkle(10.4, 11.4, 2.8, `fill="${C.white}" stroke-width="1.3"`),

  // ── menu ─────────────────────────────────────────────────────────────
  island:
    `<path stroke="${C.seaInk}" d="M3.6 37.6 q3.2 -3 6.4 0 t6.4 0 t6.4 0 t6.4 0 t6.4 0 t6.4 0"/>` +
    `<path d="M8 36.4 Q13 24.6 23 26 Q33.4 22.6 40 36.2 Z" fill="${C.grass}"/>` +
    `<path d="M22 26 L22.4 18.4" stroke="${C.trunk}" stroke-width="2.4"/>` +
    `<path d="M15.6 15.4 Q16 9 22.2 8.6 Q28.6 8.4 29.4 14.6 Q29.6 19.6 22.6 19.8 Q16 19.8 15.6 15.4 Z" fill="${C.leaf}"/>` +
    sparkle(37.4, 12, 4.6, `fill="${C.yellow}" stroke-width="1.5"`),
  // Grow a town: three little houses in a row with a sparkle.
  grow:
    `<path d="M5.6 38.6 L5.8 27.4 L11.4 21.6 L17.2 27.4 L17.2 38.6 Z" fill="${C.wall}"/>` +
    `<path d="M15.8 38.6 L15.8 22.6 L23.6 14.6 L31.4 22.6 L31.4 38.6 Z" fill="${C.pink}"/>` +
    `<path d="M30 38.6 L30.2 28.6 L35.8 23 L41.6 28.6 L41.6 38.6 Z" fill="${C.sea}"/>` +
    `<path stroke-width="1.6" d="M21.6 38.4 L21.6 31.4 L25.6 31.4 L25.6 38.4"/><path d="M3.6 38.8 L44.4 38.6"/>` +
    sparkle(39.6, 10.6, 5.2, `fill="${C.yellow}" stroke-width="1.5"`),
  // A die showing five: grow a town on a new island.
  dice:
    `<path d="M9.4 11.2 Q9.6 8.8 12 8.8 L36.2 9 Q38.8 9.2 38.8 11.8 L38.6 36.4 Q38.4 39 35.8 39 L11.8 38.8 Q9.2 38.6 9.2 36 Z" fill="${C.white}"/>` +
    `<g fill="${PALETTE.ink}" stroke="none"><circle cx="16.6" cy="16.4" r="2.6"/><circle cx="31.6" cy="16.6" r="2.6"/><circle cx="24" cy="24" r="2.6"/>` +
    `<circle cx="16.4" cy="31.4" r="2.6"/><circle cx="31.4" cy="31.6" r="2.6"/></g>`,
  share:
    `<g stroke-width="2.6"><path d="M21 27 L27 21"/><path d="M19.6 20.6 L24 16.2 A6.2 6.2 0 0 1 32.8 25 L28.6 29.2"/>` +
    `<path d="M28.4 27.4 L24 31.8 A6.2 6.2 0 0 1 15.2 23 L19.4 18.8" transform="translate(0 0)"/></g>`,
  postcard:
    `<path d="M6.4 12.6 L41.4 12.2 L41.6 35.6 L6.6 36 Z" fill="${C.white}"/>` +
    `<path d="M32.4 16 L38 15.9 L38.1 22 L32.5 22.1 Z" fill="${C.pink}" stroke-width="1.5"/>` +
    `<path ${thin} d="M26 26.4 L37.6 26.2 M26 30.6 L35 30.4"/>` +
    `<path stroke-width="1.5" d="M10 31.6 Q13.6 22.6 17.4 26.4 Q20 21.6 22.6 31.4 Z" fill="${C.leaf}"/>`,
  download: `<g stroke-width="2.6"><path d="M24 8 L24.1 28 M16 20.6 L24.1 28.6 L32 20.6"/><path d="M9 30.4 L9.2 39.4 L39 39.2 L39.2 30.2"/></g>`,
  open: `<g stroke-width="2.6"><path d="M24 30 L24.1 9 M16 16.6 L24.1 8.6 L32 16.6"/><path d="M9 30.4 L9.2 39.4 L39 39.2 L39.2 30.2"/></g>`,
  'sound-on':
    `<path d="M8.6 19.6 L15.6 19.4 L24.6 11.6 L24.8 36.4 L15.6 28.6 L8.8 28.6 Z" fill="${C.white}"/>` +
    `<path stroke-width="2.4" d="M30 18.4 Q34.4 24 30 29.8 M35 13 Q42.6 24 35 35"/>`,
  'sound-off':
    `<path d="M8.6 19.6 L15.6 19.4 L24.6 11.6 L24.8 36.4 L15.6 28.6 L8.8 28.6 Z" fill="${C.white}"/>` +
    `<path stroke-width="2.4" d="M31 19 L40.4 29.2 M40.4 19 L31 29.2"/>`,
  tune:
    `<path stroke-width="2.4" d="M8 14 L40 13.8 M8 24.2 L40 24 M8 34.2 L40 34"/>` +
    `<circle cx="17" cy="14" r="3.6" fill="${C.yellow}"/><circle cx="31" cy="24" r="3.6" fill="${C.pink}"/><circle cx="21" cy="34" r="3.6" fill="${C.sea}"/>`,
  // The held-length stepper's − and +.
  less: `<path stroke-width="3.2" d="M12.4 24.6 Q24 23.2 35.8 24.2"/>`,
  more: `<path stroke-width="3.2" d="M12.4 24.6 Q24 23.2 35.8 24.2 M24.4 12.2 Q23.4 24 24.2 35.8"/>`,
  close: `<path stroke-width="2.8" d="M13 13.4 L35 34.8 M35 13.2 L13.2 35"/>`,
  // The colour swatch on "auto": four pastel quarters and a sparkle.
  'swatch-auto':
    `<path d="M24 24 L24 7 A17 17 0 0 1 41 24 Z" fill="${RAMPS.wall[0]}" stroke="none"/>` +
    `<path d="M24 24 L41 24 A17 17 0 0 1 24 41 Z" fill="${RAMPS.wall[2]}" stroke="none"/>` +
    `<path d="M24 24 L24 41 A17 17 0 0 1 7 24 Z" fill="${RAMPS.wall[4]}" stroke="none"/>` +
    `<path d="M24 24 L7 24 A17 17 0 0 1 24 7 Z" fill="${RAMPS.wall[3]}" stroke="none"/>` +
    `<circle cx="24" cy="24" r="17"/>` +
    sparkle(24, 24, 7.6, `fill="${C.white}" stroke-width="1.6"`),
  // The ✨ over an Auto block while the Change tool is selected.
  sparkle: sparkle(22, 26, 18, `fill="${C.white}" stroke-width="3"`) + sparkle(39, 9, 7, `fill="${C.yellow}" stroke-width="2.4"`),
  // Random house style: a die, its three faces showing one, two and three.
  styleDice:
    `<path d="${CUBE_LEFT}" fill="${C.white}"/><path d="${CUBE_RIGHT}" fill="${C.stoneShade}"/><path d="${CUBE_TOP}" fill="${C.white}"/>` +
    `<g fill="${C.ink}" stroke="none"><ellipse cx="24.1" cy="15.9" rx="2.3" ry="1.4"/>` +
    `<circle cx="12.6" cy="22.4" r="1.7"/><circle cx="19.5" cy="35.4" r="1.7"/>` +
    `<circle cx="28.3" cy="34.6" r="1.7"/><circle cx="32.2" cy="29" r="1.7"/><circle cx="36.1" cy="23.4" r="1.7"/></g>`,
  // A kind with no drawing yet.
  unknown: `<path d="${CUBE_LEFT}" fill="${C.stone}"/><path d="${CUBE_RIGHT}" fill="${C.stoneShade}"/><path d="${CUBE_TOP}" fill="${C.white}"/>`,
};

// ─────────────────────────────────────────────────────────── house styles ──

/** A window on the house front at (x, y): its family's shape, glass, a cross bar, and shutters if it has them. */
function styleWindow(family: string, x: number, y: number, accent: string): string {
  const f = (n: number): string => n.toFixed(1);
  if (family === 'tall') {
    return `<rect x="${f(x)}" y="${f(y - 2.6)}" width="4.6" height="9.6" rx="0.6" fill="${C.glass}"/><path ${thin} d="M${f(x + 2.3)} ${f(y - 2.4)} L${f(x + 2.3)} ${f(y + 6.8)} M${f(x + 0.2)} ${f(y + 1.6)} L${f(x + 4.4)} ${f(y + 1.6)}"/>`;
  }
  if (family === 'arched') {
    return `<path d="M${f(x)} ${f(y + 6.6)} L${f(x)} ${f(y + 1.6)} Q${f(x + 2.9)} ${f(y - 2.6)} ${f(x + 5.8)} ${f(y + 1.6)} L${f(x + 5.8)} ${f(y + 6.6)} Z" fill="${C.glass}"/><path ${thin} d="M${f(x + 2.9)} ${f(y - 0.6)} L${f(x + 2.9)} ${f(y + 6.4)}"/>`;
  }
  const pane = `<rect x="${f(x)}" y="${f(y)}" width="6.2" height="6" rx="0.7" fill="${C.glass}"/><path ${thin} d="M${f(x + 3.1)} ${f(y + 0.2)} L${f(x + 3.1)} ${f(y + 5.8)} M${f(x + 0.2)} ${f(y + 3)} L${f(x + 6)} ${f(y + 3)}"/>`;
  if (family !== 'shuttered') return pane;
  return pane + `<rect ${thin} x="${f(x - 2.8)}" y="${f(y - 0.2)}" width="2.5" height="6.4" fill="${accent}"/><rect ${thin} x="${f(x + 6.5)}" y="${f(y - 0.2)}" width="2.5" height="6.4" fill="${accent}"/>`;
}

/** The front door at x = 15.6–22.3, standing on the ground line. */
function styleDoor(door: string, accent: string): string {
  if (door === 'arched') return `<path d="M15.6 40.6 L15.7 32.4 Q19 27.6 22.2 32.4 L22.3 40.5 Z" fill="${accent}"/>`;
  if (door === 'glazed') return `<path d="M15.7 40.6 L15.8 30.6 L22.2 30.5 L22.3 40.5 Z" fill="${accent}"/><rect ${thin} x="17.3" y="32" width="3.4" height="3.6" fill="${C.glass}"/>`;
  if (door === 'panel') return `<path d="M15.7 40.6 L15.8 30.6 L22.2 30.5 L22.3 40.5 Z" fill="${accent}"/><path ${thin} d="M17.2 32.2 L20.8 32.2 L20.8 35 L17.2 35 Z M17.2 36.4 L20.8 36.4 L20.8 39.2 L17.2 39.2 Z"/>`;
  return `<path d="M15.7 40.6 L15.8 30.6 L22.2 30.5 L22.3 40.5 Z" fill="${accent}"/><path ${thin} d="M18 30.8 L18 40.4 M20.1 30.7 L20.1 40.4"/>`;
}

/**
 * A tiny house in a style (design section 7, "House style"), for the House
 * button's flyout: the style's roof, walls, windows, door and chimney over
 * the given wall colour (a palette index; the roof follows the style's
 * stand-in for colours its own would clash with). Style 0 is the dice.
 */
export function styleIcon(style: number, wallIndex: number): string {
  const st = houseStyle(style);
  if (!st) return icon('styleDice');
  const c = ((wallIndex % 8) + 8) % 8;
  const wall = RAMPS.wall[c]!;
  const accent = styleAccent(st, c);
  const roof = st.cover === 'thatch' ? PALETTE.sand : RAMPS.roof[styleRoof(st, c)]!;
  const stack = st.chimney.stack === 'stone' ? PALETTE.stoneShade : st.chimney.stack === 'plaster' ? PALETTE.white : C.brick;
  const pots = st.chimney.pots === 2 ? `<path ${thin} d="M31.6 9.2 L31.6 7.2 M34.4 9.2 L34.4 7.2"/>` : `<path ${thin} d="M33 9.2 L33 7"/>`;
  const plankLines = (y0: number, y1: number): string => {
    let d = '';
    for (let y = y0; y < y1; y += 3.4) d += `M11 ${y.toFixed(1)} L37.3 ${(y - 0.2).toFixed(1)} `;
    return `<path ${thin} stroke="${C.woodDark}" stroke-opacity="0.55" d="${d}"/>`;
  };
  let body =
    `<path d="M30.5 9.4 L30.8 19 L35.6 19.2 L35.4 9.2 Z" fill="${stack}"/>` + pots +
    `<path d="M10.4 23.6 L10.8 40.7 L37.5 40.3 L37.8 23.4 Z" fill="${wall}"/>`;
  // Walls.
  if (st.walls === 'planks') body += plankLines(27, 40);
  else if (st.plankUpper) body += plankLines(27, 31);
  if (st.walls === 'timber') {
    body += `<path stroke-width="1.7" stroke="${C.trunk}" d="M10.8 31.4 L37.5 31.2 M13.4 23.8 L13.6 40.4 M25 23.6 L25 40.4 M34.8 23.5 L34.8 40.3 M13.6 31.4 L25 23.8 M25 31.2 L34.8 23.6"/>`;
  }
  if (st.storeyBands) body += `<path stroke-width="1.6" d="M10.6 30.4 L37.6 30.2"/>`;
  // Roof.
  if (st.cover === 'thatch') {
    body +=
      `<path d="M5.4 25.4 Q6 23 9 21.4 L22.6 9 Q24 7.4 25.4 9 L39.6 21.4 Q42.4 23.2 42.6 25.2 Q24 27.4 5.4 25.4 Z" fill="${roof}"/>` +
      `<path ${thin} stroke="${C.dirtDark}" d="M13 19.4 L11.4 23.6 M18 15 L16.6 24.4 M24 10.8 L24 24.8 M30 15 L31.4 24.4 M35 19.4 L36.6 23.6"/>`;
  } else {
    body += `<path d="M6.3 24.6 L23.7 8.6 L41.8 24.2 Z" fill="${roof}"/>`;
    if (st.timberGable) {
      // The gable end under the eaves, half-timbered.
      body +=
        `<path ${thin} d="M13.4 23.8 L23.8 14.2 L34.4 23.6 Z" fill="${wall}"/>` +
        `<path ${thin} stroke="${C.trunk}" d="M18.6 19.2 L29 19.1 M23.8 14.6 L23.8 23.6 M19.6 23.6 L23.8 19.2 L28.2 23.6"/>`;
    } else body += `<path ${thin} stroke-opacity="0.45" d="M14.6 19.2 L33 19 M19.6 14.4 L28 14.3"/>` + `<circle cx="23.9" cy="18.2" r="2.4" fill="${C.white}"/>`;
  }
  // Openings: the door on the left, a window on the right.
  body += styleDoor(st.door, accent) + styleWindow(st.family, 27.4, 31.4, accent);
  return (
    `<svg class="lc-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="${PALETTE.ink}" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g filter="url(#lc-wobble)">${body}</g></svg>`
  );
}

export function hasIcon(id: string): boolean {
  return id in DRAWINGS && id !== 'unknown';
}

/** Every icon id, for the gallery's icon sheet. */
export function iconIds(): string[] {
  return Object.keys(DRAWINGS);
}

/** SVG markup for an icon; scales with the box it is put in (see .lc-icon in ui.css). */
export function icon(id: string): string {
  const body = DRAWINGS[id] ?? DRAWINGS.unknown!;
  return (
    `<svg class="lc-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="${PALETTE.ink}" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g filter="url(#lc-wobble)">${body}</g></svg>`
  );
}

/**
 * The pen wobble every icon shares: a slight, fixed displacement, so lines
 * drawn straight above come out a little uneven, as they do in the town.
 * Put once into the page (icons refer to it by id).
 */
export function iconDefs(): string {
  return (
    `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>` +
    `<filter id="lc-wobble" x="-10%" y="-10%" width="120%" height="120%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="n"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G"/>` +
    `</filter></defs></svg>`
  );
}
