// The page shaders (Look, Stage 1): the paper behind the drawing, and the
// composite that turns the surface pass into an inked, graded picture.
//
// Line weight answers to zoom (LOOK.inkWidth*, index.ts): thin and even at the overview, and up
// close the outline of a thing (a depth jump) grows to about a pixel and a half while the lines
// inside it (seams, creases) stay under a pixel.
//
// Ink. A line is drawn wherever, between a pixel and its four neighbours at
// the pen's half-width,
//   the depth jumps        (a silhouette: one thing in front of another),
//   the ink id changes     (a seam between two surfaces), or
//   the normal turns       (a crease).
// The depth test compares the second difference of depth, which is zero on
// any flat surface however steeply it is seen, so the ground never turns
// black at low camera angles and thresholds are in world units.
//
// The pen: line position wanders by up to about half a CSS pixel and the
// weight and ink density swell and thin slowly along the stroke. The noise
// lives on the things drawn (see penAt), so a line keeps its own wobble when
// the view pans, orbits or zooms instead of crawling through a noise field
// fixed to the screen, and it is static unless LOOK.boil is on.
//
// Then the dusk grade (grade.ts), lit windows with a warm halo, stars on
// the bare paper, and last the paper grain, added after everything so that
// it survives at any brightness.

import { COLOR, NOISE } from './surface';

/** A triangle that covers the screen. */
export const screenVertex = /* glsl */ `
precision highp float;
in vec3 position;
out vec2 vUv;
void main(){
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** The paper, drawn behind everything, with the soft shadow of the floating slab. */
export const paperFragment = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform vec3 uPaper;        // sRGB
uniform vec3 uInk;          // sRGB
uniform vec3 uEye;          // centre of the camera plane
uniform vec3 uRight;        // camera right * half width
uniform vec3 uUp;           // camera up * half height
uniform vec3 uForward;
uniform vec4 uSlab;         // centre x, centre z, half size x, half size z
uniform float uShadowY;
uniform float uShadow;
layout(location = 0) out vec4 oColor;
layout(location = 1) out vec4 oId;
float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main(){
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 p = uEye + uRight * ndc.x + uUp * ndc.y;
  // Where this pixel's ray meets the sheet of paper the island floats above.
  float t = (uShadowY - p.y) / min(uForward.y, -0.01);
  vec3 hit = p + uForward * t;
  float d = sdRound(hit.xz - uSlab.xy - vec2(-0.5, -0.9), uSlab.zw, 3.4);
  float sh = uShadow * (1.0 - smoothstep(-1.4, 2.6, d));
  oColor = vec4(mix(uPaper, uInk, sh), 0.0);
  oId = vec4(0.5, 0.5, 0.0, 0.0);
}
`;

/**
 * Fly mode's paper: seen from inside the town most of the page is sky. Bare paper above the horizon
 * with a soft wash of the sea's colour low down (the dusk grade warms it like the rest of the page, so
 * it is the day's colour); below it, round the slab, a loose watercolour sea laid on the paper that
 * thins out to bare paper before the horizon, with a few pencilled swells, so the slab's edge reads
 * as the edge of a drawing rather than the end of the world. Clouds, the moon and the stars are drawn
 * over it (clouds are geometry; the moon and stars are the composite's).
 */
export const skyFragment = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform vec3 uPaper;        // sRGB
uniform vec3 uInk;          // sRGB
uniform vec3 uSeaWash;      // sRGB
uniform vec3 uEye;
uniform vec3 uRight;        // right * tan(half fov across)
uniform vec3 uUp;           // up * tan(half fov up)
uniform vec3 uForward;
uniform vec4 uSlab;         // centre x, centre z, half size x, half size z
uniform float uSeaY;
uniform float uPxAngle;     // the height of a CSS pixel, as a tangent, at the screen's centre
uniform float uFlat;        // 0 the sky, to 1 the builder's paper (a narrow field of view: eyecam.ts)
uniform float uShadowY;     // the builder's paper: the sheet under the slab, and its shadow's strength
uniform float uShadow;
layout(location = 0) out vec4 oColor;
layout(location = 1) out vec4 oId;
${NOISE}
float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main(){
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 dir = normalize(uForward + uRight * ndc.x + uUp * ndc.y);
  float az = atan(dir.x, dir.z);
  vec3 col = uPaper;
  // A wash low in the sky, its upper edge wandering as a brush's does.
  float reach = 0.16 + 0.05 * (n2(vec2(az * 3.0, 1.0)) - 0.5) + 0.03 * (n2(vec2(az * 11.0, 4.0)) - 0.5);
  float sky = 1.0 - smoothstep(0.0, reach, max(dir.y, 0.0));
  col = mix(col, uSeaWash, sky * 0.32 * step(0.0, dir.y));
  if (dir.y < 0.0) {
    // The far sea: where this ray meets the water's level, outside the slab.
    float t = (uSeaY - uEye.y) / dir.y;
    vec2 hit = uEye.xz + dir.xz * max(t, 0.0);
    vec2 q = abs(hit - uSlab.xy) - uSlab.zw;
    float out_ = length(max(q, 0.0));
    float fadeAway = 1.0 - smoothstep(4.0, 70.0 + 30.0 * n2(vec2(az * 2.0, 7.0)), out_);
    float wash = (0.55 + 0.45 * fadeAway) * fadeAway * smoothstep(0.0, 0.004, -dir.y);
    wash *= 0.92 + 0.16 * n2(hit * 0.05);
    col = mix(col, uSeaWash, clamp(wash, 0.0, 1.0) * 0.9);
    // A few long swells in pencil, lying on the water, thinning out with the wash.
    float w = hit.y * 0.35 + 0.6 * n2(hit * 0.04);
    float fw = max(fwidth(w), 1e-4);
    float line = 1.0 - smoothstep(0.0, fw * 1.4, abs(fract(w) - 0.5) - 0.0);
    float broken = smoothstep(0.55, 0.7, n2(vec2(hit.x * 0.08, floor(w) * 3.1)));
    col = mix(col, mix(uSeaWash, uInk, 0.35), line * broken * fadeAway * 0.5 * step(fw, 0.4));
  }
  // The horizon, pencilled lightly where the sea wash has thinned away.
  float hz = abs(dir.y) / max(uPxAngle, 1e-5);
  col = mix(col, uInk, (1.0 - smoothstep(0.3, 1.1, hz)) * 0.18 * (0.6 + 0.4 * n2(vec2(az * 40.0, 2.0))));
  if (uFlat > 0.0) {
    // Seen down a narrow field of view from far off, the picture is the orbit camera's, and so is the
    // page behind it: paper, with the slab's shadow where this ray meets the sheet under it (paperFragment).
    float sh = 0.0;
    if (dir.y < -1e-4) {
      vec3 hit = uEye + dir * ((uShadowY - uEye.y) / dir.y);
      sh = uShadow * (1.0 - smoothstep(-1.4, 2.6, sdRound(hit.xz - uSlab.xy - vec2(-0.5, -0.9), uSlab.zw, 3.4)));
    }
    col = mix(col, mix(uPaper, uInk, sh), uFlat);
  }
  oColor = vec4(col, 0.0);
  oId = vec4(0.5, 0.5, 0.0, 0.0);
}
`;

export const compositeFragment = /* glsl */ `
precision highp float;
precision highp sampler2D;
precision highp sampler3D;
in vec2 vUv;
out vec4 oColor;

uniform sampler2D tColor;
uniform sampler2D tId;
uniform sampler2D tDepth;
uniform sampler3D tNoise;
#ifdef INK_TEX
uniform sampler2D tInk;
#endif
uniform vec2 uOut;         // this pass's target size, device pixels
uniform float uPR;         // device pixels per CSS pixel in this target
uniform vec2 uOrigin;      // the world origin on screen, CSS pixels from the bottom left
uniform float uTime;
uniform vec3 uEye;         // the camera: centre of its plane, right and up times the half size,
uniform vec3 uRight;       // the way it looks, and the near plane's distance (world units)
uniform vec3 uUp;
uniform vec3 uForward;
uniform float uNear;
uniform float uCss;        // CSS pixels per world unit
uniform float uThick;      // line width of a silhouette, CSS pixels
uniform float uInner;      // width of seams and creases, as a share of it
uniform float uDepthRange; // far - near, world units
uniform float uDepthT;     // depth jump threshold, world units
uniform vec3 uWeights;     // ink strength of a silhouette, a seam, a crease
uniform float uWobble;
uniform float uBoil;
uniform float uPaperAmt;
uniform vec3 uInk;
uniform vec3 uTint;
uniform vec3 uLift;
uniform float uSat;
uniform vec3 uShadeTint;   // the tint of faces turned away from the light
uniform vec3 uLightView;   // the light's direction in view space
uniform float uChroma;
uniform float uContrast;
uniform vec3 uLampWarm;
uniform vec3 uStar;
uniform float uGlow;
uniform float uStars;
uniform float uHalo;
uniform float uFestive;
uniform float uFog;        // Seasons: mist, 0 to 1 (lying low, by the water)
uniform vec3 uFogCol;      // its colour, graded (the paper's)
uniform float uFogY;       // the waterline    // Seasons: festival lights up; halos take each light's own colour
#ifdef PERSP
// Fly mode. uEye is the eye, uRight and uUp are the screen's right and up times the tangent of the
// half field of view, so a pixel's ray is uForward + uRight * ndc.x + uUp * ndc.y. linZ() turns a
// depth sample into the distance along the view: from a reversed floating-point buffer (REVZ, 1 at
// the near plane, 0 at the far one) or from the straight distance the surface wrote itself.
uniform float uFocal;      // CSS pixels per world unit at a distance of one
uniform vec4 uInkW;        // line widths: far, near outline, inner; and the far detail share
uniform vec2 uInkPx;       // the zooms (CSS pixels per unit) called far and near
uniform float uFlat;       // 0 stars on the sky, to 1 stars on the page (a narrow field of view: eyecam.ts)
uniform vec3 uMoon;        // the moon's direction
float gInner = 1.0;
vec3 gWeights = vec3(1.0);
#define INNER gInner
#define WEIGHTS gWeights
float linZ(float d){
#ifdef REVZ
  return uNear * (uNear + uDepthRange) / (d * uDepthRange + uNear);
#else
  return uNear + d * uDepthRange;
#endif
}
#else
#define INNER uInner
#define WEIGHTS uWeights
#endif
// Of two depth samples, the nearer.
#if defined(PERSP) && defined(REVZ)
#define NEARER max
#else
#define NEARER min
#endif

${NOISE}
${COLOR}

// Value noise in 3D, four channels at once: a 32-cube of random values (index.ts) read with the
// hardware's filtering at smoothed coordinates, so it is as smooth as computed value noise for one
// texture read instead of eight hashes.
vec4 n3(vec3 p){
  vec3 i = floor(p), f = p - i;
  return texture(tNoise, (i + f * f * (3.0 - 2.0 * f) + 0.5) / 32.0);
}

// The pen at this pixel: x, y the line's wobble (-0.5 to 0.5, CSS pixels), z its weight and w its
// ink density (0 to 1, slow). The noise is read at the world point under the pixel, so it travels
// with the drawing. Across an outline the two sides lie far apart, so it is read at the nearest
// surface within two pixels: both sides of a line, and the line itself, share one point. Its scale
// follows the zoom in powers of two, blended (as the hatching's spacing is), so the wobble stays
// about five pixels long at every zoom and nothing jumps while zooming.
vec4 penAt(vec2 uv, float t){
  vec2 r = 2.0 * uPR / uOut;
  float d = texture(tDepth, uv).x;
#ifndef INK_TEX
  // (Where the lines came from the half-resolution ink pass only the density is read here, and a
  // density that differs either side of an outline does not show.)
  d = NEARER(d, NEARER(texture(tDepth, uv + vec2(r.x, 0.0)).x, texture(tDepth, uv - vec2(r.x, 0.0)).x));
  d = NEARER(d, NEARER(texture(tDepth, uv + vec2(0.0, r.y)).x, texture(tDepth, uv - vec2(0.0, r.y)).x));
#endif
  vec2 ndc = uv * 2.0 - 1.0;
#ifdef PERSP
  float z = linZ(d);
  vec3 p = uEye + (uForward + uRight * ndc.x + uUp * ndc.y) * z + t;
  float lod = log2(max(uFocal / z, 1e-3));
#else
  vec3 p = uEye + uRight * ndc.x + uUp * ndc.y + uForward * (uNear + d * uDepthRange) + t;
  float lod = log2(max(uCss, 1e-3));
#endif
  float o = floor(lod), fr = lod - o, s = exp2(o);
  // Each pair of octaves spans a factor of two on the page around the pen's own scale: about five
  // pixels for the wobble (0.21 a pixel) and a few dozen for weight and density (0.04).
  // The finer octave of one zoom is the coarser of the next, offset and all, so there is no seam.
  vec2 slow = mix(n3(p * s * 0.04 + 41.0).zw, n3(p * s * 0.08 + 41.0).zw, fr);
#ifdef INK_TEX
  return vec4(0.0, 0.0, slow);          // the lines were found in the ink pass; only the density is left
#else
  vec2 wob = mix(n3(p * s * 0.21).xy, n3(p * s * 0.42).xy, fr);
  return vec4(wob - 0.5, slow);
#endif
}

vec3 decN(vec4 s){ vec2 xy = s.xy * 2.0 - 1.0; return vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy)))); }

// px is the pen's half-width for silhouettes; seams and creases, the lines inside a shape, are
// drawn with a finer one (uInner of it), so a close-up keeps a delicate interior and a firm outline.
// Seams and creases: the ink id changes or the normal turns between a point and its four neighbours.
float surfaceEdgeAt(vec2 uv, vec2 px){
  vec4 s0 = texture(tId, uv);
  vec3 n0 = decN(s0);
  vec2 ox = vec2(px.x * INNER, 0.0), oy = vec2(0.0, px.y * INNER);
  vec4 sa = texture(tId, uv + ox), sb = texture(tId, uv - ox), sc = texture(tId, uv + oy), sd = texture(tId, uv - oy);
  float eId = step(0.5 / 255.0, abs(sa.z - s0.z) + abs(sa.w - s0.w));
  eId = max(eId, step(0.5 / 255.0, abs(sb.z - s0.z) + abs(sb.w - s0.w)));
  eId = max(eId, step(0.5 / 255.0, abs(sc.z - s0.z) + abs(sc.w - s0.w)));
  eId = max(eId, step(0.5 / 255.0, abs(sd.z - s0.z) + abs(sd.w - s0.w)));
  float turn = min(min(dot(n0, decN(sa)), dot(n0, decN(sb))), min(dot(n0, decN(sc)), dot(n0, decN(sd))));
  float eN = 1.0 - smoothstep(0.8, 0.9, turn);
  return max(eId * WEIGHTS.y, eN * WEIGHTS.z);
}

// Silhouettes: the depth jumps. Depth is read at whole texels, the same distance either side of the
// centre, so that the second difference is exactly zero across a flat surface at any slant and any
// zoom, and large across a jump. At the frame's edge the centre is pulled in until both sides exist: a
// missing side would read as a jump on any sloping surface (the sea running off the top of the
// picture) and draw a row of scribble.
float depthEdgeAt(vec2 uv, vec2 px){
  ivec2 size = textureSize(tDepth, 0);
  ivec2 o = min(max(ivec2(1), ivec2(px * vec2(size) + 0.5)), (size - 1) / 2);
  ivec2 c = clamp(ivec2(floor(uv * vec2(size))), o, size - 1 - o);
  float dm = texelFetch(tDepth, c, 0).x;
  float da = texelFetch(tDepth, c + ivec2(o.x, 0), 0).x, db = texelFetch(tDepth, c - ivec2(o.x, 0), 0).x;
  float dc = texelFetch(tDepth, c + ivec2(0, o.y), 0).x, dd = texelFetch(tDepth, c - ivec2(0, o.y), 0).x;
#ifdef PERSP
  // In perspective a flat surface's depth is not linear across the screen, its reciprocal is: the
  // second difference of 1 / depth is zero on any flat face, and times depth squared it is the jump
  // in world units again, so the threshold means what it means to the orbit camera.
  float zm = linZ(dm);
  float im = 1.0 / zm;
  float ia = 1.0 / linZ(da), ib = 1.0 / linZ(db);
  float ic = 1.0 / linZ(dc), id = 1.0 / linZ(dd);
  float jump = max(abs(ia + ib - 2.0 * im), abs(ic + id - 2.0 * im)) * zm * zm;
#else
  float jump = max(abs(da + db - 2.0 * dm), abs(dc + dd - 2.0 * dm)) * uDepthRange;
#endif
  vec4 s0 = texture(tId, uv);
  float drawn = step(0.5 / 255.0, s0.z + s0.w);   // bare paper has ink id 0 and no depth of its own
  return smoothstep(uDepthT, uDepthT * 2.0, jump) * drawn * WEIGHTS.x;
}

// Four rotated sub-samples, a pixel's width apart: cheap anti-aliasing for the ink. With fewer (there
// used to be two where the picture is not super-sampled: phones, and screens of 1.5x and up) a seam or
// crease a pixel or less wide popped on and off as it crossed pixel centres while the camera moved.
// Where the picture is not super-sampled, silhouettes (the wider outline) keep two: the other two
// would read the same depth texels. Where it is (FINE_DEPTH), each tap has depth texels of its own.
float edge(vec2 uv, float thick){
  vec2 px = thick * uPR * 0.5 / uOut;
  vec2 q = 0.5 / uOut;
  vec2 t1 = vec2(q.x, 0.5 * q.y), t2 = vec2(-0.5 * q.x, q.y), t3 = vec2(-q.x, -0.5 * q.y), t4 = vec2(0.5 * q.x, -q.y);
#ifdef FINE_DEPTH
  return 0.25 * (max(surfaceEdgeAt(uv + t1, px), depthEdgeAt(uv + t1, px)) + max(surfaceEdgeAt(uv + t2, px), depthEdgeAt(uv + t2, px))
               + max(surfaceEdgeAt(uv + t3, px), depthEdgeAt(uv + t3, px)) + max(surfaceEdgeAt(uv + t4, px), depthEdgeAt(uv + t4, px)));
#else
  float surf = 0.25 * (surfaceEdgeAt(uv + t1, px) + surfaceEdgeAt(uv + t2, px) + surfaceEdgeAt(uv + t3, px) + surfaceEdgeAt(uv + t4, px));
  float depth = 0.5 * (depthEdgeAt(uv + t1, px) + depthEdgeAt(uv + t3, px));
  return max(surf, depth);
#endif
}

void main(){
  vec2 fc = gl_FragCoord.xy / uPR;     // CSS pixels, so grain and wobble do not depend on the pixel ratio
  vec2 fw = fc - uOrigin;              // ... and these follow the world when the view pans
  float t = uBoil * floor(uTime * 2.0) * 17.31;
  float steady = min(uWobble, 1.0);

  vec4 pen = penAt(vUv, t);
  float thick = uThick;
#ifdef PERSP
  // Line weight by distance, as the orbit camera's is by zoom (index.ts): the scale of the page is
  // read at the nearest surface round this pixel, so both sides of an outline agree.
  {
    vec2 r = 2.0 * uPR / uOut;
    float d = texture(tDepth, vUv).x;
    d = NEARER(d, NEARER(texture(tDepth, vUv + vec2(r.x, 0.0)).x, texture(tDepth, vUv - vec2(r.x, 0.0)).x));
    d = NEARER(d, NEARER(texture(tDepth, vUv + vec2(0.0, r.y)).x, texture(tDepth, vUv - vec2(0.0, r.y)).x));
    float css = uFocal / linZ(d);
    float nearPx = max(uInkPx.x + 1.0, uInkPx.y);
    float closeness = clamp((css - uInkPx.x) / (nearPx - uInkPx.x), 0.0, 1.0);
    float beyond = clamp(css / max(1.0, uInkPx.x), 0.3, 1.0);
    float detail = (uInkW.w + (1.0 - uInkW.w) * closeness) * beyond;
    float outline = (uInkW.x + (uInkW.y - uInkW.x) * closeness) * max(0.7, beyond);
    // Closer than the builder can ever zoom (a door at arm's length), the outline keeps growing a
    // little, as a pen drawing's does round the thing in front: a thin line round a huge shape reads as
    // a rendering, not a drawing.
    outline *= 1.0 + 0.5 * smoothstep(150.0, 600.0, css);
    float ease = clamp((closeness - 0.25) / 0.6, 0.0, 1.0);
    float inner = outline + (min(outline, uInkW.z) - outline) * ease * ease * (3.0 - 2.0 * ease);
    thick = outline;
    gInner = inner / max(1e-3, outline);
    gWeights = vec3(uWeights.x, uWeights.y * detail, uWeights.z * detail);
  }
#endif
#ifndef INK_TEX
  float weight = mix(1.0, 0.72 + 0.56 * pen.z, steady);
  float e = edge(vUv + pen.xy * uWobble * uPR / uOut, thick * weight);
#else
  float e = texture(tInk, vUv).r;
#endif

#if defined(INK_ONLY)
  oColor = vec4(e, e, e, 1.0);
#elif defined(GHOST)
  // The ghost preview over the finished page: its wash, graded like the page, outlined in pencil
  // (graphite: lighter than the pen, and the pressure comes and goes along the stroke).
  vec4 c0 = texture(tColor, vUv);
  vec3 wash = c0.rgb * uTint;
  wash = mix(vec3(dot(wash, vec3(0.299, 0.587, 0.114))), wash, uSat) + uLift;
  float pencil = clamp(e * 1.15, 0.0, 1.0) * (0.55 + 0.45 * n2(fw * 0.13 + 5.0 + t));
  vec3 lead = mix(uInk, uTint * 0.7, 0.28);
  oColor = vec4(mix(wash * c0.a, lead, pencil), 1.0 - (1.0 - c0.a) * (1.0 - pencil));
#else
  vec4 c0 = texture(tColor, vUv);
  vec4 sid = texture(tId, vUv);
  float bg = 1.0 - step(0.5 / 255.0, sid.z + sid.w);     // bare paper
  vec3 col = c0.rgb;
  float glow = c0.a;

  // The dusk grade: the whole page is tinted, paper included. Lit glass keeps its own colour.
  // (grade.ts has the same arithmetic as gradeColor(); change both together.)
  //   chroma    materials are pushed apart in hue first, so a strong tint cannot merge them;
  //   contrast  pale things keep their brightness and mid-tones drop;
  //   tint      warm (or moonlit) on faces turned to the light, cool on faces turned away.
  const vec3 LUM = vec3(0.299, 0.587, 0.114);
  vec3 g = mix(vec3(dot(col, LUM)), col, uChroma);
  g *= pow(max(dot(g, LUM), 1e-3), uContrast - 1.0);
  float facing = mix(dot(decN(sid), uLightView), 1.0, bg);
  g *= mix(uShadeTint, uTint, smoothstep(-0.15, 0.35, facing));
  g = mix(vec3(dot(g, LUM)), g, uSat) + uLift;
  g = mix(g, col, glow);
  if (uGlow > 0.01 && uHalo > 0.0) {
    // A warm halo round anything lit: two rings of taps on the glow channel.
    float h = 0.0;
    vec3 hc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854;
      vec2 d = vec2(cos(a), sin(a)) * uPR / uOut;
      vec4 t1 = texture(tColor, vUv + d * 4.5), t2 = texture(tColor, vUv + d * 10.0);
      h += t1.a + 0.6 * t2.a;
      hc += t1.rgb * t1.a + 0.6 * t2.rgb * t2.a;
    }
    // Seasons: while the festival's lights are up, a halo takes the colour of what glows.
    vec3 warm = uFestive > 0.0 ? mix(uLampWarm, hc / max(h, 1e-3), uFestive * 0.7) : uLampWarm;
    h = clamp(h / 8.0, 0.0, 1.0);
    g += warm * h * uHalo * uGlow * (1.0 - glow) * 0.55;
  }

#ifdef PERSP
  // Fly mode: the stars and the moon belong to the sky, not to the screen. A pixel's direction is
  // laid flat (seen from straight below, so the sky's every direction has one place) and the same
  // stars are drawn there at the same size in pixels as on the orbit camera's page. Down a narrow
  // field of view (uFlat, a dolly zoom out to the builder's view) they give way to the page's own.
  vec2 ndcS = vUv * 2.0 - 1.0;
  vec3 dirS = normalize(uForward + uRight * ndcS.x + uUp * ndcS.y);
  float skyUp = smoothstep(0.0, 0.08, dirS.y);
  vec3 gSky = g;
  if (uStars > 0.0 && skyUp > 0.0 && uFlat < 1.0) {
    vec2 fs = dirS.xz / (1.0 + dirS.y) * 640.0;
    vec2 sc = fs / 27.0; vec2 ci = floor(sc); vec2 f = fract(sc) - 0.5;
    float r = h1(ci);
    vec2 d = (f - (vec2(h1(ci + 1.7), h1(ci + 5.3)) - 0.5) * 0.7) * 27.0;
    float size = 0.7 + 1.5 * h1(ci + 9.1);
    float twinkle = 0.7 + 0.3 * sin(uTime * (0.8 + r * 2.0) + r * 40.0);
    float star = 1.0 - smoothstep(size * 0.55, size, length(d));
    star = max(star, (1.0 - smoothstep(0.0, 0.5, min(abs(d.x), abs(d.y)))) * (1.0 - smoothstep(size, size * 2.6, length(d))) * step(1.6, size));
    gSky = mix(gSky, uStar, star * step(0.82, r) * twinkle * uStars * bg * skyUp);
    // The moon: the orbit camera's drawing, laid on the sky in the moon's direction.
    vec3 mr = normalize(cross(uMoon, vec3(0.0, 1.0, 0.0)));
    vec3 mu = cross(mr, uMoon);
    float facing = dot(dirS, uMoon);
    vec2 q = vec2(dot(dirS, mr), dot(dirS, mu)) / max(facing, 0.05) * 560.0 * step(0.0, facing);
    q += vec2(1e4) * (1.0 - step(0.0, facing));
    float md = length(q);
    float moon = 1.0 - smoothstep(26.0, 27.5, md);
    float bite = 1.0 - smoothstep(24.0, 25.5, length(q - vec2(11.0, 6.0)));
    float lit = moon * (1.0 - bite * 0.85);
    float mrim = (1.0 - smoothstep(0.0, 1.2, abs(md - 26.5))) * 0.5;
    gSky = mix(gSky, uStar * 1.04, lit * uStars * bg * (0.8 + 0.2 * n2(q * 0.12)));
    gSky = mix(gSky, uInk, mrim * uStars * bg * 0.5);
  }
#define PAGE_STARS (uFlat > 0.0)
#else
#define PAGE_STARS true
#endif
  if (uStars > 0.0 && PAGE_STARS) {
    vec2 sc = fc / 27.0; vec2 ci = floor(sc); vec2 f = fract(sc) - 0.5;
    float r = h1(ci);
    vec2 d = (f - (vec2(h1(ci + 1.7), h1(ci + 5.3)) - 0.5) * 0.7) * 27.0;
    float size = 0.7 + 1.5 * h1(ci + 9.1);
    float twinkle = 0.7 + 0.3 * sin(uTime * (0.8 + r * 2.0) + r * 40.0);
    float star = 1.0 - smoothstep(size * 0.55, size, length(d));
    // the bigger ones are drawn as a little four-point sparkle
    star = max(star, (1.0 - smoothstep(0.0, 0.5, min(abs(d.x), abs(d.y)))) * (1.0 - smoothstep(size, size * 2.6, length(d))) * step(1.6, size));
    g = mix(g, uStar, star * step(0.82, r) * twinkle * uStars * bg);
    // L10: the moon, a pale disc with a pencilled rim, high on the page's right, on bare paper only.
    vec2 mc = vec2(uOut.x / uPR - 120.0, uOut.y / uPR - 110.0);
    float md = length(fc - mc);
    float moon = 1.0 - smoothstep(26.0, 27.5, md);
    float bite = 1.0 - smoothstep(24.0, 25.5, length(fc - mc - vec2(11.0, 6.0)));
    float lit = moon * (1.0 - bite * 0.85);
    float mrim = (1.0 - smoothstep(0.0, 1.2, abs(md - 26.5))) * 0.5;
    g = mix(g, uStar * 1.04, lit * uStars * bg * (0.8 + 0.2 * n2(fc * 0.12)));
    g = mix(g, uInk, mrim * uStars * bg * 0.5);
    // L10: rarely, a shooting star: in one window of ~23 s in four, a short bright streak across the
    // paper that draws itself and is gone in under a second.
    float win = floor(uTime / 23.0);
    float tw = uTime - win * 23.0;
    if (h1(vec2(win, 7.7)) > 0.75 && tw < 0.9) {
      vec2 s0 = vec2(h1(vec2(win, 1.3)), 0.55 + 0.4 * h1(vec2(win, 2.9))) * uOut / uPR;
      vec2 sd = normalize(vec2(-1.0, -0.45 - 0.3 * h1(vec2(win, 4.1))));
      float len = 140.0 * tw / 0.9;
      vec2 rel = fc - s0;
      float along = dot(rel, sd), off = abs(dot(rel, vec2(-sd.y, sd.x)));
      float trail = step(0.0, along) * step(along, len) * (along / max(len, 1.0));
      float fadeOut = 1.0 - smoothstep(0.6, 0.9, tw);
      g = mix(g, uStar, (1.0 - smoothstep(0.4, 1.4, off)) * trail * fadeOut * uStars * bg);
    }
  }
#ifdef PERSP
  g = mix(gSky, g, uFlat);
#endif

  // Seasons: mist. It lies low, thickest at the water and thinning up the hills, in slow banks that
  // drift; it is read at the world point under the pixel, so it stays put when the view turns.
  float mist = 0.0;
  if (uFog > 0.0) {
    float dd = texture(tDepth, vUv).x;
    vec2 ndc = vUv * 2.0 - 1.0;
#ifdef PERSP
    // (Fly mode: along the pixel's ray. Bare sky has no point under it; the far plane stands in.)
    vec3 wp = uEye + (uForward + uRight * ndc.x + uUp * ndc.y) * linZ(dd);
#else
    vec3 wp = uEye + uRight * ndc.x + uUp * ndc.y + uForward * (uNear + dd * uDepthRange);
#endif
    float banks = n2(wp.xz * 0.13 + uTime * vec2(0.025, 0.01)) * 0.65 + n2(wp.xz * 0.41 - uTime * 0.02) * 0.35;
    float low = 1.0 - smoothstep(uFogY + 0.05, uFogY + 2.8, wp.y + (banks - 0.5) * 1.6);
    mist = uFog * mix(low * (0.45 + 0.55 * banks), 0.35, bg) * (1.0 - glow * 0.7);
    g = mix(g, uFogCol, clamp(mist, 0.0, 0.85));
  }
  float dens = mix(1.0, 0.8 + 0.2 * pen.w, steady);
  dens *= 1.0 - 0.55 * clamp(mist, 0.0, 1.0);
  // Seasons: a small light glowing is not swallowed by its own outline.
  if (uFestive > 0.0) dens *= 1.0 - glow * uFestive * 0.6;
  g = mix(g, uInk, clamp(e * 1.15, 0.0, 1.0) * dens);

  // Paper grain, after everything: per-pixel tooth, short fibres, soft mottling, the odd fleck.
  float speck = h1(floor(fc)) - 0.5;
  float fibre = n2(vec2(fc.x * 0.08 + fc.y * 0.03, fc.y * 0.9 - fc.x * 0.25)) - 0.5;
  float mott = (n2(fc * 0.011) - 0.5) + 0.6 * (n2(fc * 0.032 + 5.0) - 0.5);
  float fleck = step(0.9965, h1(floor(fc * 0.5) + 3.1));
  float grain = speck * 0.05 + fibre * 0.04 + mott * 0.05 - fleck * 0.06;
  float page = 0.4 + 0.6 * dot(uTint, vec3(0.3333));     // darker paper shows less tooth
  g += uPaperAmt * grain * mix(0.36, 1.0, bg) * page * (1.0 - glow);
  oColor = vec4(g, 1.0);
#endif
}
`;
