// Seasons and weather in the surface shader (design section 13a). Everything here is shading on the
// surfaces the town already has, driven by a handful of uniforms (src/render/season.ts works them
// out each frame from signals.season and signals.weather), so a change of season rebuilds nothing.
//
//   seasonLeaves    crowns turn yellow, orange, russet or brown, each tree at its own time (its
//                   ink id is its seed); willows yellow and then go to bare whips; pines darken
//   seasonGrass     spring's fresh green, autumn's yellowed patches, winter's frost
//   seasonWater     the sea greys in winter; ponds, fountains and the sheltered rim of the shore
//                   freeze; rain rings
//   seasonSurface   wet ground and roofs (and puddles on paving), then settled snow
//   bareCut         (BARE only) the leaves of a broadleaf fall as its crown dissolves in blobs,
//                   showing the branches drawn inside it
//
// Snow is the paper showing through: wherever a surface faces the sky and nothing stands over it
// (the grounding height picture says what is over a point), cover rises past a wandering threshold
// with a soft inked edge. It gathers first in corners (the contact shade) and toward eaves (where the
// ground falls away just downhill of a roof), lies in cool shadow tones on faces turned from the light,
// and melts back from sunny faces first.
//
// Foliage is marked by the tree generator in `edge` (src/gen/foliage.ts): 201 a broadleaf crown, 202
// an evergreen, 203 fruit and blossom on a crown, 204 a willow's strands, 205 a shrub, 206 the
// branches inside a crown. The patterns these surfaces use never read `edge`, so summer is untouched.
//
// When uSeasonOn is 0 (summer, clear sky) none of this runs: the picture is exactly what it was.

/** Declarations for the vertex shader (the rest position, for a dissolve that does not crawl). */
export const SEASON_VERTEX = /* glsl */ `
#ifdef BARE
out vec3 vRest;
#endif
`;

export const SEASON_FRAGMENT = /* glsl */ `
#ifdef BARE
in vec3 vRest;
#endif
uniform float uSeasonOn;
uniform vec4 uSeason;       // weights: spring, summer, autumn, winter
uniform vec4 uTrees;        // turn, bare, blossom, cold
uniform vec4 uSnow;         // cover, thaw, falling, ice
uniform vec4 uWet;          // wet, rain, cloud, frost (grass where no snow lies)
uniform vec3 uLeafRef;      // the greens the pieces were built in (linear)
uniform vec3 uGrassRef;
uniform vec3 uSpringGreen;
uniform float uSpringMix;
uniform vec3 uAutumnGrass;
uniform float uAutumnGrassMix;
uniform vec3 uLeafA;
uniform vec3 uLeafB;
uniform vec3 uLeafC;
uniform vec3 uLeafD;
uniform vec3 uFrost;
uniform vec3 uSnowCol;
uniform vec3 uSnowShade;
uniform float uSnowEdge;
uniform vec3 uWetTint;
uniform vec3 uIce;
uniform vec3 uTwig;
uniform vec3 uBlossomA;
uniform vec3 uBlossomB;

float lumOf(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// The foliage code (0 for anything else).
float foliageOf(){ return (vEdge > 200.5 && vEdge < 206.5) ? floor(vEdge - 199.5) : 0.0; }
// A tree's own numbers, from its crown's ink id.
float treeSeed(float k){ return h1(vId * 255.0 + k); }
// Each tree turns, and drops its leaves, at its own time: the early ones first on both counts.
float treeTurn(){ float o = treeSeed(0.71) * 0.45; return smoothstep(o, o + 0.45, uTrees.x); }
float treeBare(){ float o = treeSeed(0.71) * 0.38; return smoothstep(o, o + 0.6, uTrees.y); }
vec3 ratio(vec3 a, vec3 b){ return a / max(b, vec3(1e-3)); }

#ifdef BARE
// A falling leaf: the crown dissolves in blobs (fixed to the tree at rest, so they do not crawl as it
// sways), the early trees first.
bool bareCut(){
  float fol = foliageOf();
  if (fol < 0.5 || (fol > 1.5 && fol < 2.5) || fol > 3.5) return false;
  float tb = treeBare();
  if (tb <= 0.0) return false;
  float nz = 0.6 * n2(vRest.xy * 6.5 + treeSeed(2.3) * 40.0) + 0.4 * n2(vRest.zy * 11.0 + 5.0);
  return nz < tb * 1.2 - 0.08;
}
#endif

vec3 seasonLeaves(vec3 col, float fol){
  float L = lumOf(col) / max(lumOf(uLeafRef), 1e-3);
  if (fol > 1.5 && fol < 2.5) {
    // Evergreens keep their green, a little darker and bluer in winter.
    return col * mix(vec3(1.0), vec3(0.86, 0.9, 0.98), uSeason.w);
  }
  if (fol > 5.5) return col;                                   // branches
  if (fol > 2.5 && fol < 3.5) {
    // Fruit and blossom: white or pink blossom in spring, the fruit in summer and autumn.
    vec3 bl = treeSeed(6.1) < 0.55 ? uBlossomA : uBlossomB;
    return mix(col, bl, uTrees.z);
  }
  // Spring: a fresher, lighter green.
  col = mix(col, col * ratio(uSpringGreen, uLeafRef), uSeason.x * uSpringMix);
  float turn = treeTurn();
  if (fol > 3.5 && fol < 4.5) {
    // A willow: yellow in autumn, then bare golden whips through winter.
    col = mix(col, uLeafA * L, turn * 0.85);
    return mix(col, uTwig * mix(0.8, 1.15, step(0.9, L)), treeBare());
  }
  if (fol > 0.5 && fol < 1.5) {
    // A broadleaf: one of four colours, mottled with a second, green lingering in flecks.
    float pick = treeSeed(4.13);
    vec3 t = pick < 0.3 ? uLeafA : (pick < 0.55 ? uLeafB : (pick < 0.8 ? uLeafC : uLeafD));
    vec3 t2 = pick < 0.3 ? uLeafB : (pick < 0.55 ? uLeafC : (pick < 0.8 ? uLeafD : uLeafB));
    t = mix(t, t2, smoothstep(0.5, 0.75, n2(vW.xz * 2.1 + vW.y * 1.7 + pick * 20.0)) * 0.55);
    float fleck = n2(vW.xz * 3.3 + vW.y * 2.9 + 11.0);
    float k = clamp(turn * 1.3 - (1.0 - turn) * (fleck - 0.3), 0.0, 1.0);
    return mix(col, t * L, k);
  }
  // Shrubs and hedges: a touch of autumn, duller in winter.
  col = mix(col, uLeafC * L * 0.9, turn * 0.22);
  return mix(col, vec3(lumOf(col)) * vec3(0.95, 1.0, 0.95), uSeason.w * 0.25);
}

vec3 seasonGrass(vec3 g){
  float spots = smoothstep(0.35, 0.65, n2(vW.xz * 0.37 + 21.0));
  g = mix(g, g * ratio(uSpringGreen, uGrassRef), uSeason.x * uSpringMix);
  g = mix(g, g * ratio(uAutumnGrass, uGrassRef), uSeason.z * uAutumnGrassMix * (0.5 + 0.5 * spots));
  g = mix(g, g * ratio(uFrost, uGrassRef), uWet.w * (0.75 + 0.25 * spots));
  return g;
}

vec3 seasonWater(vec3 c, float sd, float riv, bool inland, inout float pen){
  // Winter and a grey sky take the summer out of the sea.
  c = mix(c, vec3(lumOf(c)) * vec3(0.9, 0.96, 1.04), uSeason.w * 0.32 + uWet.z * 0.22);
  c *= 1.0 - 0.08 * uSeason.w;
  if (uSnow.w > 0.0) {
    // Ice: ponds and basins freeze over; the sea and the rivers freeze only along a sheltered rim.
    float e = inland ? uSnow.w * 1.6 - 0.6 : uSnow.w * (riv > 0.5 ? 0.32 : 0.36) - sd;
    e += (n2(vW.xz * 2.7) - 0.5) * 0.14 + (n2(vW.xz * 9.0) - 0.5) * 0.04;
    float fw = max(fwidth(e), 1e-4);
    float frozen = smoothstep(-fw, fw, e);
    vec3 ice = uIce * (0.97 + 0.05 * n2(vW.xz * 1.6));
    // Cracks, and settled snow lying on it.
    float cr = abs(fract(vW.x * 0.9 + vW.z * 0.6 + n2(vW.xz * 1.3) * 1.5) - 0.5);
    float crack = lineAA(cr, 0.012) * smoothstep(0.5, 0.7, n2(vW.xz * 0.8 + 3.0)) * fade(0.4);
    ice = mix(ice, uSnowCol, smoothstep(0.35, 0.6, uSnow.x + (n2(vW.xz * 1.9) - 0.5) * 0.5) * 0.85);
    c = mix(c, ice, frozen);
    pen += frozen * crack * 0.25 + (1.0 - smoothstep(0.7, 1.7, abs(e) / fw)) * 0.4;
  }
  if (uWet.y > 0.0) {
    // Rain on the water: little rings that open and fade, each at its own place and moment.
    vec2 p = vW.xz * 2.2; vec2 ci = floor(p); vec2 f = fract(p) - 0.5;
    float r = h1(ci + 7.3);
    f -= (vec2(h1(ci + 1.1), h1(ci + 2.9)) - 0.5) * 0.5;
    float age = fract(uTime * (0.9 + 0.5 * r) + r * 13.0);
    float ring = lineAA(abs(length(f * vec2(1.0, 1.3)) - age * 0.32), 0.022) * (1.0 - age) * step(1.0 - uWet.y * 0.85, h1(ci + floor(uTime * (0.9 + 0.5 * r) + r * 13.0)));
    c = mix(c, uSnowCol, ring * 0.75 * fade(0.3));
  }
  return c;
}

vec3 seasonSurface(vec3 col, vec3 n, float s, int pat, bool top, inout float pen, inout float hatchable, out float snowAmt){
  snowAmt = 0.0;
  float fol = foliageOf();
  bool leafy = fol > 0.5 && fol < 5.5 || pat == 17;
  if (leafy) col = seasonLeaves(col, fol);
  if (pat == 20 && top) {
    // Crops: cut to pale stubble in autumn, the soil showing through in winter.
    col = mix(col, col * vec3(1.12, 1.0, 0.72), uSeason.z * 0.55);
    col = mix(col, col * vec3(0.82, 0.74, 0.66), uSeason.w * 0.6);
  }
  if (pat == 7 || pat == 25 || pat == 24) return col;     // glass, lamps and foam: never wet or snowed on
  vec2 jit = (vec2(n2(vW.xz * 2.3), n2(vW.xz * 2.3 + 9.0)) - 0.5) * 0.09;
  float over = heightOver(vW.xz + jit) - vW.y;
  // Under something (an eave, an arch, an awning, a crown in leaf): no rain and no snow. Crowns and
  // branches are what is over everything else, so they always count as open.
  float open = (leafy || fol > 5.5) ? 1.0 : 1.0 - smoothstep(0.03, 0.16, over);
  if (uWet.x > 0.0) {
    float up = smoothstep(0.2, 0.7, n.y);
    float w = uWet.x * mix(0.3, 1.0, up * open) * (leafy ? 0.45 : 1.0);
    col *= mix(vec3(1.0), uWetTint, w);
    if (top && open > 0.5 && (pat == 5 || pat == 14 || pat == 23 || pat == 0)) {
      // Puddles in the low spots of paving, cobbles and trails: dark, with a pale streak of sky.
      float pd = n2(vW.xz * 0.9 + 17.0) + (n2(vW.xz * 3.7) - 0.5) * 0.18;
      float pfw = max(fwidth(pd), 1e-4);
      float puddle = smoothstep(0.69 - pfw, 0.69 + pfw, pd + uWet.x * 0.06 - 0.06) * smoothstep(0.3, 0.8, uWet.x);
      float sky = smoothstep(0.62, 0.8, fract((vW.x - vW.z) * 1.4 + n2(vW.xz * 2.0) * 0.4));
      col = mix(col, mix(col * vec3(0.62, 0.66, 0.78), uSnowCol * 0.92, sky * 0.45), puddle);
      pen += (1.0 - smoothstep(0.7, 1.7, abs(pd + uWet.x * 0.06 - 0.06 - 0.69) / pfw)) * 0.3 * smoothstep(0.3, 0.8, uWet.x);
      if (uWet.y > 0.0 && puddle > 0.5) {
        vec2 p = vW.xz * 3.0; vec2 ci = floor(p); vec2 f = fract(p) - 0.5;
        float r = h1(ci + 3.3);
        float age = fract(uTime * (1.1 + 0.5 * r) + r * 7.0);
        pen += lineAA(abs(length(f) - age * 0.36), 0.03) * (1.0 - age) * step(0.4, r) * uWet.y * 0.5 * fade(0.3);
      }
    }
  }
  if (uSnow.x > 0.0) {
    // Settled snow. Crowns are lit by tone, not by their true slope: their lit lumps carry it.
    float face = leafy ? smoothstep(0.12, 0.26, n.y) : smoothstep(0.3, 0.72, n.y);
    // Evergreens hold it in clumps on their sunny boughs, green showing between.
    if (fol > 1.5 && fol < 2.5) face *= 0.6;
    if (face > 0.0 && open > 0.0) {
      float corner = smoothstep(0.1, 0.5, texture(tShade, (vW.xz + jit - uMap.xy) * uMap.z).r);
      float eave = 0.0;
      if (n.y > 0.3 && n.y < 0.95) eave = smoothstep(0.2, 0.5, vW.y - heightOver(vW.xz + normalize(n.xz) * 0.16));
      float drift = n2(vW.xz * 1.1 + vW.y * 0.7) * 0.6 + n2(vW.xz * 4.3 + vW.y * 2.0 + 3.0) * 0.4;
      // Melting: the sunny faces first.
      float sun = uSnow.y * smoothstep(0.85, 1.0, s) * 0.25;
      // Trodden paths and plazas keep less.
      float trod = (pat == 5 || pat == 14 || pat == 23) ? 0.16 * n2(vW.xz * vec2(0.8, 2.6) + 7.0) : 0.0;
      float e = uSnow.x * 1.3 * face * open + (drift - 0.5) * 0.45 + corner * 0.22 + eave * 0.18 - sun - trod;
      float fw = max(fwidth(e), 1e-4);
      float cov = smoothstep(0.5 - fw, 0.5 + fw, e);
      // Before it lies, a dusting: flecks that thicken.
      vec2 dp = vW.xz * 8.0 + vW.y * 3.0; vec2 dc = floor(dp); vec2 df = fract(dp) - 0.5;
      df -= (vec2(h1(dc + 2.0), h1(dc + 9.0)) - 0.5) * 0.6;
      float dust = lineAA(length(df), 0.16) * step(1.0 - smoothstep(0.0, 0.6, uSnow.x) * 0.8, h1(dc + 5.0)) * face * open * fade(0.12);
      snowAmt = max(cov, dust * 0.85);
      // The paper, toned like any surface but cooler in the shade.
      float st = mix(s, 1.0, 0.55);
      vec3 sc = uSnowCol * st * mix(vec3(1.0), uSnowShade / max(uSnowCol, vec3(1e-3)), clamp((1.0 - s) * 2.6, 0.0, 1.0));
      col = mix(col, sc, snowAmt);
      pen *= 1.0 - cov * 0.85;
      // A soft inked edge where the snow ends, and faint drift lines on wide snow.
      pen += (1.0 - smoothstep(0.7, 1.7, abs(e - 0.5) / fw)) * uSnowEdge * face * open;
      pen += lineAA(abs(fract(drift * 4.0 + vW.y) - 0.5), 0.02) * cov * 0.07 * fade(0.25) * step(0.9, n.y);
      hatchable = mix(hatchable, hatchable * 0.7, cov);
    }
  }
  return col;
}
`;
