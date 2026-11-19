// Grounding (Look): what makes pieces sit ON the ground instead of floating
// on it by their outline alone. It is drawn the way an illustrator shades,
// not the way a renderer casts shadows:
//
//   contact   a soft darker tone on the ground hugging the foot of anything
//             that stands on it, on every side;
//   cover     the ground under a crown, an arch, a deck or an eave is in
//             shade, with the shape of the thing above;
//   cast      a short shadow on the side away from the light, longer at
//             dusk, with a wobbly edge;
//   foot      walls darken a little where they meet the ground, and under
//             an overhang.
//
// All of it comes from ONE small picture of the town seen from straight
// above: the height of the highest thing over each point of the map
// (`heightVertex`, redrawn only when geometry changes or something moves).
// A second pass (`shadeFragment`) turns heights into two numbers per point,
// "how hemmed in is this spot" and "how high is the horizon toward the
// light", once, so the surface shader pays one or two texture reads per
// pixel. The surface shader then lays the result down as a cooler tone plus
// pencil hatching (see surface.ts). There is no shadow map, no light
// camera and nothing view-dependent, so it cannot shimmer or swim.

/** The square of map the height picture covers, and its height range (world units). */
export const GROUND_MAP = { x0: -2, z0: -2, size: 52, top: 28, range: 30 } as const;

/** Draws geometry from straight above: x and z become the picture's axes, height becomes depth. */
export const heightVertex = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
in vec3 position;
in vec4 color;
in float slot;
uniform sampler2D uSlots;
uniform vec4 uMap;        // x0, z0, 1 / size, top
uniform float uMapRange;
void main(){
  vec3 p = position;
  float glow = 1.0;
  int s = int(slot + 0.5);
  if (s > 0) {
    ivec2 at = ivec2((s & 63) * 4, s >> 6);
    vec4 r0 = texelFetch(uSlots, at, 0);
    vec4 r1 = texelFetch(uSlots, at + ivec2(1, 0), 0);
    vec4 r2 = texelFetch(uSlots, at + ivec2(2, 0), 0);
    glow = texelFetch(uSlots, at + ivec2(3, 0), 0).x;
    p = vec3(dot(r0.xyz, position) + r0.w, dot(r1.xyz, position) + r1.w, dot(r2.xyz, position) + r2.w);
  }
  // Light beams and ghosts are not there as far as the ground is concerned.
  if (abs(color.a * 255.0 - 27.0) < 0.5 || glow < -0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 uv = (p.xz - uMap.xy) * uMap.z;
  gl_Position = vec4(uv * 2.0 - 1.0, (uMap.w - p.y) / uMapRange * 2.0 - 1.0, 1.0);
}
`;

export const heightFragment = /* glsl */ `
precision highp float;
out vec4 oColor;
void main(){ oColor = vec4(0.0); }
`;

/**
 * Heights to shade. Output: r = contact (how much taller things crowd this
 * spot), g = the tangent of the horizon toward the light, divided by 3.
 */
export const shadeFragment = /* glsl */ `
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 oColor;
uniform sampler2D tHeight;
uniform vec4 uMap;
uniform float uMapRange;
uniform vec2 uToLight;    // unit vector on the ground, toward the light
float heightAt(vec2 xz){ return uMap.w - texture(tHeight, (xz - uMap.xy) * uMap.z).x * uMapRange; }
void main(){
  vec2 p = vUv / uMap.z + uMap.xy;
  float h0 = heightAt(p);
  // Contact: two rings of taps; anything a hand's width taller than here counts.
  float contact = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7854;
    vec2 d = vec2(cos(a), sin(a));
    contact += smoothstep(0.1, 0.45, heightAt(p + d * 0.13) - h0) * 0.6;
    contact += smoothstep(0.1, 0.45, heightAt(p + vec2(d.x * 0.9239 - d.y * 0.3827, d.x * 0.3827 + d.y * 0.9239) * 0.3) - h0) * 0.4;
  }
  contact /= 8.0;
  // Cast: walk toward the light and remember the steepest thing in the way.
  float horizon = 0.0;
  for (int i = 0; i < 32; i++) {
    float t = 0.05 + 2.4 * pow(float(i) / 31.0, 1.3);
    horizon = max(horizon, (heightAt(p + uToLight * t) - h0 - 0.06) / t);
  }
  oColor = vec4(contact, clamp(horizon / 3.0, 0.0, 1.0), 0.0, 1.0);
}
`;
