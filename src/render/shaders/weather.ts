// Falling rain and snow (Seasons, design section 13a), drawn over the finished page.
//
// Nothing is stored per particle but its number: the vertex shader makes each one from that. The ground is
// cut into square tiles fixed to the world; tile (i, j) holds the same particles at the same places
// whatever the camera does, so turning the view shows the same flakes from a new side instead of a
// flat sheet sliding over the picture. A particle falls through a column from uTop down, drifting
// with the wind; it is hidden where something stands over it (the grounding height picture: under
// an eave, an arch, a crown) and where the drawing is in front of it (the page's depth).
//
// Rain is a pencil streak along its fall, slanted by the wind, tapering at both ends; snow is a flake
// of paper with a faint graphite rim (so it reads against settled snow) that flutters as it falls.

export const precipVertex = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 uZOrigin;
uniform vec3 uZAxis;
uniform sampler2D tHeight;
uniform vec4 uMap;
uniform float uMapRange;
uniform vec2 uBase;      // the first tile of the square of tiles drawn
uniform float uTiles;    // tiles a side
uniform float uPer;      // particles a tile
uniform float uTile;     // tile size, world units
uniform float uKeep;     // the share of particles shown (intensity, the cap, the zoom)
uniform float uTime;
uniform float uTop;
uniform float uFloor;
uniform float uSpeed;    // units a second, falling
uniform vec2 uDrift;     // the wind, units a second
uniform float uSnow;     // 0 rain, 1 snow
uniform vec2 uView;      // drawing buffer size, pixels
uniform float uPR;       // device pixels per CSS pixel
uniform float uLen;      // a rain streak's length, world units
in float position;       // the vertex's number (gl_VertexID is not dependable on every GPU)

out vec2 vC;
out float vA;

uvec3 pcg3d(uvec3 v){
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec4 rnd(ivec2 tile, int j){
  uvec3 a = pcg3d(uvec3(uint(tile.x + 4096), uint(tile.y + 4096), uint(j)));
  uvec3 b = pcg3d(a ^ uvec3(0x9e3779b9u));
  return vec4(vec3(a & 0xffffu) / 65536.0, float(b.x & 0xffffu) / 65536.0);
}
float heightOver(vec2 xz){ return uMap.w - textureLod(tHeight, (xz - uMap.xy) * uMap.z, 0.0).x * uMapRange; }

void main(){
  int id = int(position + 0.5);
  int slot = id / 6, c = id - slot * 6;
  const vec2 CORNERS[6] = vec2[6](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0));
  vec2 corner = CORNERS[c];
  int per = int(uPer + 0.5), tiles = int(uTiles + 0.5);
  int t = slot / per, j = slot - t * per;
  ivec2 tile = ivec2(uBase + 0.5) + ivec2(t - (t / tiles) * tiles, t / tiles);
  vec4 r = rnd(tile, j);
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vC = corner;
  vA = 0.0;
  if (r.w >= uKeep) return;
  float H = uTop - uFloor;
  float speed = uSpeed * (0.8 + 0.4 * r.z);
  float fall = H / speed;
  float age = fract(uTime / fall + r.y);
  vec2 at = (vec2(tile) + r.xz) * uTile;
  vec3 p = vec3(at.x, uTop - age * H, at.y);
  p.xz += uDrift * age * fall;
  if (uSnow > 0.5) {
    // A flake flutters: a slow swing across its fall.
    float s = sin(uTime * (0.9 + 0.8 * r.x) + r.z * 40.0);
    p.xz += vec2(s, cos(uTime * 0.7 + r.x * 30.0)) * 0.12;
  }
  // Only over the island's square, and only in the open: not under a roof, an arch or a crown, and
  // not below the ground (where it has landed).
  if (p.x < -1.0 || p.z < -1.0 || p.x > 49.0 || p.z > 49.0) return;
  if (p.y < heightOver(p.xz) + 0.02) return;
  vec4 head = projectionMatrix * viewMatrix * vec4(p, 1.0);
  float z = dot(p - uZOrigin, uZAxis);
  vec2 px = 2.0 * uPR / uView;     // one CSS pixel in clip space
  vec2 off;
  if (uSnow > 0.5) {
    float size = 1.2 + 1.8 * r.x * r.x * r.x;
    off = corner * px * size;
    gl_Position = vec4(head.xy + off, z, 1.0);
  } else {
    vec3 vel = vec3(uDrift.x, -speed, uDrift.y);
    vec3 q = p - normalize(vel) * uLen * (0.7 + 0.6 * r.x);
    vec4 tail = projectionMatrix * viewMatrix * vec4(q, 1.0);
    // Across the stroke on the page: the fall's direction seen by the camera (orthographic, so the
    // view's x and y are the page's), turned a quarter.
    vec3 seen = mat3(viewMatrix) * vel;
    vec2 dir = normalize(seen.xy + vec2(1e-5, 0.0));
    vec2 side = vec2(-dir.y, dir.x) * px;
    vec2 mid = mix(tail.xy, head.xy, corner.y * 0.5 + 0.5);
    gl_Position = vec4(mid + side * corner.x * 0.75, mix(dot(q - uZOrigin, uZAxis), z, corner.y * 0.5 + 0.5), 1.0);
  }
  vA = 0.55 + 0.45 * r.y;
}
`;

export const precipFragment = /* glsl */ `
precision highp float;
precision highp sampler2D;
in vec2 vC;
in float vA;
out vec4 oColor;
uniform sampler2D tDepth;
uniform vec2 uCanvas;
uniform float uSnow;
uniform vec3 uRainCol;     // sRGB, already graded
uniform vec3 uFlakeCol;
uniform vec3 uRimCol;
uniform float uRainInk;
uniform float uFlakeInk;
uniform float uAmount;
void main(){
  if (gl_FragCoord.z > texture(tDepth, gl_FragCoord.xy / uCanvas).x + 0.00003) discard;
  if (uSnow > 0.5) {
    float d = length(vC);
    float fill = 1.0 - smoothstep(0.55, 0.85, d);
    float rim = smoothstep(0.45, 0.7, d) * (1.0 - smoothstep(0.8, 1.0, d));
    float a = max(fill, rim * uFlakeInk) * vA * uAmount;
    vec3 c = mix(uFlakeCol, uRimCol, rim * uFlakeInk * (1.0 - fill * 0.6));
    oColor = vec4(c * a, a);
  } else {
    // A pencil stroke: heavier in the middle, lifting at both ends, soft across.
    float across = 1.0 - smoothstep(0.35, 1.0, abs(vC.x));
    float along = smoothstep(-1.0, -0.4, vC.y) * (1.0 - smoothstep(0.5, 1.0, vC.y));
    float a = across * along * uRainInk * vA * uAmount;
    oColor = vec4(uRainCol * a, a);
  }
}
`;
