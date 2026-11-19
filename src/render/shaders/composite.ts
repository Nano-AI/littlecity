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

export const compositeFragment = /* glsl */ `
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 oColor;

uniform sampler2D tColor;
uniform sampler2D tId;
uniform sampler2D tDepth;
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

${NOISE}
${COLOR}

// Value noise in 3D, four channels at once, from an integer hash: steady at any distance from the origin.
vec4 hash4(ivec3 c){
  uvec3 v = uvec3(c) * uvec3(1664525u, 1013904223u, 2654435761u);
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  uvec4 w = uvec4(v, v.x ^ v.y ^ v.z) * 747796405u;
  w ^= w >> 15u;
  return vec4(w & 0xffffu) / 65535.0;
}
vec4 n3(vec3 p){
  vec3 i = floor(p), f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  ivec3 c = ivec3(i);
  vec4 a = mix(hash4(c), hash4(c + ivec3(1, 0, 0)), f.x);
  vec4 b = mix(hash4(c + ivec3(0, 1, 0)), hash4(c + ivec3(1, 1, 0)), f.x);
  vec4 d = mix(hash4(c + ivec3(0, 0, 1)), hash4(c + ivec3(1, 0, 1)), f.x);
  vec4 e = mix(hash4(c + ivec3(0, 1, 1)), hash4(c + ivec3(1, 1, 1)), f.x);
  return mix(mix(a, b, f.y), mix(d, e, f.y), f.z);
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
  d = min(d, min(texture(tDepth, uv + vec2(r.x, 0.0)).x, texture(tDepth, uv - vec2(r.x, 0.0)).x));
  d = min(d, min(texture(tDepth, uv + vec2(0.0, r.y)).x, texture(tDepth, uv - vec2(0.0, r.y)).x));
  vec2 ndc = uv * 2.0 - 1.0;
  vec3 p = uEye + uRight * ndc.x + uUp * ndc.y + uForward * (uNear + d * uDepthRange) + t;
  float lod = log2(max(uCss, 1e-3));
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
float edgeAt(vec2 uv, vec2 px){
  vec4 s0 = texture(tId, uv);
  vec3 n0 = decN(s0);
  vec2 ox = vec2(px.x * uInner, 0.0), oy = vec2(0.0, px.y * uInner);
  vec4 sa = texture(tId, uv + ox), sb = texture(tId, uv - ox), sc = texture(tId, uv + oy), sd = texture(tId, uv - oy);
  // Depth is read at whole texels, the same distance either side of the centre, so that the second
  // difference is exactly zero across a flat surface at any slant and any zoom, and large across a jump.
  // At the frame's edge the centre is pulled in until both sides exist: a missing side would read as a
  // jump on any sloping surface (the sea running off the top of the picture) and draw a row of scribble.
  ivec2 size = textureSize(tDepth, 0);
  ivec2 o = min(max(ivec2(1), ivec2(px * vec2(size) + 0.5)), (size - 1) / 2);
  ivec2 c = clamp(ivec2(floor(uv * vec2(size))), o, size - 1 - o);
  float dm = texelFetch(tDepth, c, 0).x;
  float da = texelFetch(tDepth, c + ivec2(o.x, 0), 0).x, db = texelFetch(tDepth, c - ivec2(o.x, 0), 0).x;
  float dc = texelFetch(tDepth, c + ivec2(0, o.y), 0).x, dd = texelFetch(tDepth, c - ivec2(0, o.y), 0).x;
  float jump = max(abs(da + db - 2.0 * dm), abs(dc + dd - 2.0 * dm)) * uDepthRange;
  float drawn = step(0.5 / 255.0, s0.z + s0.w);   // bare paper has ink id 0 and no depth of its own
  float eDepth = smoothstep(uDepthT, uDepthT * 2.0, jump) * drawn;
  float eId = step(0.5 / 255.0, abs(sa.z - s0.z) + abs(sa.w - s0.w));
  eId = max(eId, step(0.5 / 255.0, abs(sb.z - s0.z) + abs(sb.w - s0.w)));
  eId = max(eId, step(0.5 / 255.0, abs(sc.z - s0.z) + abs(sc.w - s0.w)));
  eId = max(eId, step(0.5 / 255.0, abs(sd.z - s0.z) + abs(sd.w - s0.w)));
  float turn = min(min(dot(n0, decN(sa)), dot(n0, decN(sb))), min(dot(n0, decN(sc)), dot(n0, decN(sd))));
  float eN = 1.0 - smoothstep(0.8, 0.9, turn);
  return max(eDepth * uWeights.x, max(eId * uWeights.y, eN * uWeights.z));
}

// Four rotated sub-samples, a pixel's width apart: cheap anti-aliasing for the ink. With fewer (there
// used to be two where the picture is not super-sampled: phones, and screens of 1.5x and up) a line a
// pixel or less wide popped on and off as it crossed pixel centres while the camera moved.
float edge(vec2 uv, float thick){
  vec2 px = thick * uPR * 0.5 / uOut;
  vec2 q = 0.5 / uOut;
  return 0.25 * (edgeAt(uv + vec2(q.x, 0.5 * q.y), px) + edgeAt(uv + vec2(-0.5 * q.x, q.y), px)
               + edgeAt(uv + vec2(-q.x, -0.5 * q.y), px) + edgeAt(uv + vec2(0.5 * q.x, -q.y), px));
}

void main(){
  vec2 fc = gl_FragCoord.xy / uPR;     // CSS pixels, so grain and wobble do not depend on the pixel ratio
  vec2 fw = fc - uOrigin;              // ... and these follow the world when the view pans
  float t = uBoil * floor(uTime * 2.0) * 17.31;
  float steady = min(uWobble, 1.0);

  vec4 pen = penAt(vUv, t);
#ifndef INK_TEX
  float weight = mix(1.0, 0.72 + 0.56 * pen.z, steady);
  float e = edge(vUv + pen.xy * uWobble * uPR / uOut, uThick * weight);
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
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854;
      vec2 d = vec2(cos(a), sin(a)) * uPR / uOut;
      h += texture(tColor, vUv + d * 4.5).a + 0.6 * texture(tColor, vUv + d * 10.0).a;
    }
    h = clamp(h / 8.0, 0.0, 1.0);
    g += uLampWarm * h * uHalo * uGlow * (1.0 - glow) * 0.55;
  }

  if (uStars > 0.0) {
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

  float dens = mix(1.0, 0.8 + 0.2 * pen.w, steady);
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
