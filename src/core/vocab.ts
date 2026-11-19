// FROZEN CONTRACT (Stage 0). Do not edit; extend it from your own file (below).
//
// The vocabulary: every feature, prop and actor `type`, its variants and its
// params, plus socket types, role names and tags. Rule code (which emits
// these records) and part code (which draws them) both take their types from
// here, so they agree by construction: `out.feature({ type: 'windw' })` or a
// part that reads `item.params.garmets` does not compile.
//
// HOW AN ENTRY IS WRITTEN. Each registry is one interface with three key
// forms:
//   'door'          : true      a type
//   'door/double'   : true      a variant of that type
//   'door.steps'    : number    a param of that type and its value type
// Params are always optional for the emitter; the part documents and applies
// the default. Param values are numbers or strings only.
//
// HOW TO EXTEND IT (tier 2 and 3 rules, discovery rounds). Do not edit this
// file. Add a file `src/vocab/<your-domain>.vocab.ts` and merge into the
// registries with a module augmentation:
//
//   import '@/core/vocab';
//   declare module '@/core/vocab' {
//     interface FeatureVocab { 'dormer': true; 'dormer/gable': true; 'dormer.width': number;
//                              'window/oriel': true }            // a new variant of an existing type
//     interface PropVocab    { 'bench': true; 'bench/stone': true }
//     interface SocketVocab  { 'seat-back': true }
//     interface RoleVocab    { 'town-hall': 'house' }
//   }
//
// Two files may add different keys to the same registry freely. Two files
// adding the SAME key must give it the same value type, or the typecheck
// fails, which is the conflict you want to hear about.
//
// FRAMES. A part builds its mesh in its own local space; whoever places it
// supplies the frame (src/gen/frames.ts has the exact maths):
//   feature with cell + dir : origin at the bottom centre of that cell face,
//                             +Y up, +Z out of the wall, +X to the viewer's
//                             right when facing the wall from outside.
//   feature with cell only  : origin at the centre of the cell's floor, world axes.
//   feature with region only: the generator decides (roofs).
//   prop / actor at a cell  : origin on the cell's floor at the slot position,
//                             +Y up, +Z toward `face` if given, else toward the
//                             cell centre for edge and corner slots.
//   prop / actor at a socket: the socket's frame (+Y up, +Z away from the host).
//   prop on a line          : origin at the `from` socket, +X toward the `to`
//                             socket, +Y up; PartContext.span is the length.

// ───────────────────────────────────────────────────────────── features ──
// Built into a structure; emitted by role and joinery rules; baked into the
// structure's mesh by its generator; part of the structure's content hash.

export interface FeatureVocab {
  // Roof of one roof region (J04). `region` is set; the generator draws it.
  'roof': true;
  'roof/gable': true;
  'roof/hip': true;
  'roof/lean-to': true;
  'roof/flat': true; //            walkable terrace
  'roof/stepped-gable': true; //   townhouse (R-H10)
  'roof.ridge': 'x' | 'z'; //      ridge axis for gable; default the region's long axis
  'roof.lift': number; //          ridge height offset in world units (J03 row rhythm); default 0
  'roof.against': number; //       lean-to: Dir4 of the taller wall it leans on

  // Top of a tower, lighthouse or windmill structure (J13, R-T*, R-L01, R-W01). `cell` = top cell.
  // Owns sockets 'tower-top' (the tip) and 'flag-mount'.
  'cap': true;
  'cap/cone': true; //             watchtower
  'cap/spire': true; //            steeple
  'cap/lantern-room': true; //     lighthouse; owns socket 'lantern'
  'cap/mill-cap': true; //         windmill; owns socket 'mill-hub'
  'cap/flat': true;
  'cap.height': number; //         in cells; default by variant

  // An opening people can walk through (J06, J07, J26). cell + dir on the facade.
  // Owns socket 'door' (threshold, on the ground outside the wall).
  'door': true;
  'door/plain': true;
  'door/double': true; //          chapel
  'door/shop': true; //            glazed shop door
  'door/deck': true; //            onto a terrace, deck or bridge (J07, J26)
  'door/hatch': true; //           roof-terrace hatch (no dir; cell = the terrace cell)
  'door.main': 0 | 1; //           1 for the structure's main door (J06); default 0
  'door.steps': number; //         stoop steps down to the ground outside (J08); default 0

  // cell + dir on the facade (J09). Owns socket 'window' (centre of the sill, outside).
  'window': true;
  'window/square': true;
  'window/tall': true;
  'window/arched': true;
  'window/shuttered': true;
  'window/pointed': true; //       chapel
  'window/rose': true; //          chapel gable end
  'window/shopfront': true; //     ground storey of a shop
  'window/bay': true; //           shop, upper storey
  'window/slit': true; //          towers
  'window.lift': number; //        vertical offset in world units; default 0

  // On a roof region (J11). `cell` = the roof cell it stands on. Owns socket 'chimney-top'.
  'chimney': true;
  'chimney/plain': true;
  'chimney/tall-flue': true; //    beside a taller wall
  'chimney.height': number; //     world units above the roof surface; default by variant

  // Roof ornament at a ridge end or apex (R-H01). `cell` = the roof cell; `dir` = the gable end.
  'finial': true;
  'finial/cross': true;
  'finial/ball': true;

  // cell + dir on an upper storey (R-H10). Owns socket 'perch'.
  'balcony': true;
  'balcony/iron': true;
  'balcony/timber': true;

  // Open bell stage near a tower's top (R-T01). `cell` = that storey. Owns socket 'bell'.
  'belfry': true;

  // Walk-around rail on a tower or lighthouse storey (R-L01). `cell` = the storey it rings.
  // Owns sockets 'flag-mount' and 'perch'.
  'gallery': true;

  // Where a tower rises out of a house roof (J12). `cell` = the tower's lowest free cell.
  'collar': true;

  // Stone plinth under a structure's ground cells where the terrain falls away (J24). cell + dir.
  'foundation': true;
  'foundation/plinth': true;
  'foundation/cliff': true; //     against a cliff: no base trim on this side
  'foundation.depth': number; //   in cells, down to the ground; default 1

  // A worn dirt trail cell from a door toward a floor (J08). `cell` = the ground cell; walkable.
  'trail': true;

  // Vertical ladder on a face (R-H04, R-D02). cell + dir = top of the ladder.
  'ladder': true;
  'ladder.length': number; //      in cells, downward; default 1

  // A railing along one side of a walkable cell (J19; also stair rails, J18). cell + dir.
  // Variant follows the fence-style roles (R-E01).
  'railing': true;
  'railing/picket': true;
  'railing/rope': true;
  'railing/iron': true;
  'railing/balustrade': true;

  // The axis and passage of one arch cell (J15). `cell`; `dir` = the direction of the PASSAGE
  // (people walk through along dir and its opposite); the arch spans the other axis.
  // Owns socket 'arch-crown' (under the top of the opening).
  'arch-opening': true;
  'arch-opening/full': true;
  'arch-opening/half': true; //    hanging half arch; `arch-opening.toward` is the anchored side
  'arch-opening.toward': number; // Dir4

  // A pier under an arch or bridge cell (S1). `cell` = the carried arch cell.
  'pier': true;
  'pier.depth': number; //         in cells, down to the first solid top or the seabed

  // The end of a bridge or deck where it meets land or a structure (R-A01). cell + dir = outward.
  // Owns socket 'bridge-end' (on the parapet, for a lamp).
  'bridge-end': true;

  // A gate or opening in a fence or wall run (J20). `cell` for a cell piece, `edge` for an
  // edge piece. Walkable.
  'gate': true;
  'gate/picket': true;
  'gate/arched': true; //          opening in a wall

  // Carved steps between two path cells one terrain level apart (J17).
  // `cell` = the lower path cell, `dir` = toward the higher one. Walkable.
  'terrain-steps': true;

  // A short plank ramp where a dock meets a beach (J28). cell + dir = toward the land.
  'ramp': true;

  // The end of a pier (R-D02). cell + dir = out to sea.
  // Owns sockets 'pier-end' (for a lamp or flag) and 'fishing-spot'.
  'pier-head': true;

  // A mooring post or ring on a dock or quay edge (J23). cell + dir. Owns socket 'mooring'.
  'bollard': true;
}

// ──────────────────────────────────────────────────────────────── props ──
// Free-standing or attached objects; emitted by decoration and urban rules
// (dressing stage); drawn as instances. Anything that animates is a prop or
// an actor, never a feature.

export interface PropVocab {
  // D01, D02, D20, R-D02. At a floor slot or a socket ('bridge-end', 'pier-end').
  // Owns socket 'lamp-head'.
  'lamp': true;
  'lamp/post': true; //            street lamp
  'lamp/four-arm': true; //        centre of a big square
  'lamp/bridge': true; //          short, on a parapet
  'lamp/pier': true;

  // D05. On a line between two 'window' sockets. Flutters (L04). Owns socket 'perch'.
  'laundry-line': true;
  'laundry-line.garments': number; // 3–6; default 4
  'laundry-line.look': number; //    seed for garment shapes and colours

  // D07. At an 'awning-mount' socket. Flutters (L04).
  'awning': true;
  'awning/striped': true;
  'awning/plain': true;
  'awning.color': number; //       palette index into the awning ramp

  // D07. At a 'sign-bracket' socket. Swings (L29).
  'hanging-sign': true;
  'hanging-sign.shop': ShopType;

  // D09. At a 'window' socket.
  'flower-box': true;
  'flower-box.flowers': number; // index into the flower colours

  // D13. At a 'flag-mount' or 'pier-end' socket, or free-standing on a floor slot. Flutters (L04).
  'flag': true;
  'flag/pennant': true; //         on a tower cap or gallery
  'flag/banner': true;
  'flag/pole': true; //            free-standing flagpole on a square
  'flag.color': number;

  // R-A04, D06. At an 'arch-crown' socket. Owns socket 'lamp-head'.
  'hanging-lantern': true;

  // D24 wild ground. At a floor slot.
  'tuft': true;
  'tuft/grass': true;
  'tuft/flowers': true;
  'tuft.density': number; //       0–1; default 0.5
  'boulder': true;
  'beach-find': true;
  'beach-find/driftwood': true;
  'beach-find/shell': true;
  'beach-find/starfish': true;
  'reeds': true; //                in sheltered water; cell = the water cell at y = 0
  'lily-pads': true;

  // U03 front garden. At a floor slot on the garden cell's street edge.
  'garden-fence': true;
  'garden-fence/picket': true;
  'garden-fence/gate': true;
  'flower-bed': true;
  'flower-bed.flowers': number;

  // U07. At an edge slot of the street or plaza cell, facing it (anchor `face` = toward the cell).
  'retaining-wall': true;
  'retaining-wall.height': number; // in cells; default 1
  'retaining-wall.creeper': 0 | 1;
}

// ─────────────────────────────────────────────────────────────── actors ──
// Moving things; emitted by life rules; drawn as instances and driven by
// behaviours (src/life). `at` may be null for free-roaming actors.

export interface ActorVocab {
  'smoke': true; //                L02, at a 'chimney-top' socket
  'windmill-sails': true; //       L03, at a 'mill-hub' socket
  'window-light': true; //         L07, at a 'window' socket
  'window-light.order': number; // 0–1, when it lights within the 20 s dusk ramp
  'window-light.shop': 0 | 1; //   shop windows light first
  'water-ring': true; //           L06, at a cell (stilts, pillars standing in water)
  'lighthouse-beam': true; //      L09, at a 'lantern' socket

  'gull': true; //                 L11; at = null; params.home = a dock cell to circle
  'gull.home': number;
  'gull.index': number;
  'pigeon': true; //               L12; at a plaza floor slot
  'pigeon.index': number;
  'swift': true; //                L13; at = null; params.around = the structure id to loop
  'swift.around': number;
  'swift.index': number;

  'rowboat': true; //              L17, at a 'mooring' socket
  'sailboat': true; //             L19; at = null
  'sailboat.index': number;

  'resident': true; //             L21; `home` = the house structure; at = its main 'door' socket
  'resident.index': number; //     which resident of that home
  'resident.look': number; //      seed for skin, hair and clothes

  // Spawned at run time by feedback behaviours (F01, F03, F04, F07), never by rules.
  'dust-ring': true;
  'sparkle': true;
  'puff': true;
  'auto-marker': true;
}

// ────────────────────────────────────────────────────────────── sockets ──
// Typed attachment points. A rule declares the socket; the part that draws
// its owner supplies the exact frame (origin at the attachment point, +Y up,
// +Z away from the host). With no owner, or no part yet, the frame falls back
// to the cell face (with `dir`) or the cell's top centre (without).

export interface SocketVocab {
  'door': true; //          threshold, on the ground just outside; +Z out
  'window': true; //        centre of the sill, on the outer wall face; +Z out
  'chimney-top': true; //   centre of the flue opening
  'roof-ridge': true; //    a ridge end; birds perch, weathervanes mount
  'tower-top': true; //     the tip of a cap
  'flag-mount': true; //    where a flag's pole or hoist attaches
  'lantern': true; //       centre of a lighthouse lantern room
  'bell': true;
  'mill-hub': true; //      sail axle; +Z along the axle, out of the cap
  'awning-mount': true; //  above a shopfront; +Z out
  'sign-bracket': true; //  beside a door at head height; +Z out
  'arch-crown': true; //    underside of an arch, centre of the opening
  'bridge-end': true; //    top of a parapet at a bridge end
  'pier-end': true;
  'fishing-spot': true; //  where someone stands or sits to fish; +Z toward the water
  'mooring': true; //       on a bollard or stilt at the waterline; +Z out to the water
  'lamp-head': true; //     the light itself
  'perch': true; //         a bird can sit here
  'seat': true; //          a person can sit here; +Z = the way they face
  'line-anchor': true; //   one end of a line (laundry, bunting)
  'mast': true;
}

// ──────────────────────────────────────────────────────────────── roles ──
// One per structure, from a role rule (catalogue part R). The value is the
// structure kind it applies to. All catalogue tiers are listed.

export interface RoleVocab {
  // houses (R-H*, U11)
  'chapel': 'house';
  'keepers-cottage': 'house';
  'mill-house': 'house';
  'stilt-house': 'house';
  'boathouse': 'house';
  'inn': 'house';
  'shop': 'house';
  'manor': 'house';
  'townhouse': 'house';
  'row-house': 'house';
  'cliff-house': 'house';
  'greenhouse': 'house';
  'lookout-cottage': 'house';
  'cottage': 'house';
  // towers (R-T*)
  'steeple': 'tower';
  'castle-turret': 'tower';
  'clock-tower': 'tower';
  'observatory': 'tower';
  'dovecote': 'tower';
  'campanile': 'tower';
  'watchtower': 'tower';
  // lighthouse, windmill
  'lighthouse': 'lighthouse';
  'windmill': 'windmill';
  // marble (R-M*)
  'temple': 'marble';
  'gatehouse': 'marble';
  'keep': 'marble';
  'grand-steps': 'marble';
  'quay-wall': 'marble';
  'plinth': 'marble';
  'terrace': 'marble';
  // arches (R-A*)
  'stone-bridge': 'arch';
  'sky-bridge': 'arch';
  'flying-buttress': 'arch';
  'gateway': 'arch';
  'loggia': 'arch';
  'viaduct': 'arch';
  // docks (R-D*)
  'quay': 'dock';
  'pier': 'dock';
  'boardwalk': 'dock';
  'jetty': 'dock';
  // trees (R-P01)
  'palm': 'tree';
  'willow': 'tree';
  'pine': 'tree';
  'planter-tree': 'tree';
  'fruit-tree': 'tree';
  'grove-tree': 'tree';
  'round-tree': 'tree';
  'cypress': 'tree';
  'bush': 'tree';
  // fountain (R-F01), stall (R-S01)
  'tiered-fountain': 'fountain';
  'well': 'fountain';
  'birdbath': 'fountain';
  'basin': 'fountain';
  'fish-stall': 'stall';
  'flower-stall': 'stall';
  'market-stall': 'stall';
  // garden regions (R-G01)
  'wheat-field': 'garden';
  'herb-garden': 'garden';
  'reed-bed': 'garden';
  'park-lawn': 'garden';
  'kitchen-garden': 'garden';
  'flower-garden': 'garden'; // default
  // fence and wall runs (R-E01, R-E02)
  'picket-fence': 'fence';
  'rope-fence': 'fence';
  'iron-railing': 'fence';
  'stone-balustrade': 'fence';
  'low-wall': 'wall';
  'garden-wall': 'wall';
  'curtain-wall': 'wall';
}

// ───────────────────────────────────────────────────────────────── tags ──
// Extra facts a rule pins on a structure for its generator and for later
// rules. A tag has no data; encode a choice as 'name:value'.

export type ShopType = 'bakery' | 'cafe' | 'books' | 'flowers' | 'fish' | 'tailor' | 'cheese' | 'toys';

export interface TagVocab {
  'shop:bakery': true;
  'shop:cafe': true;
  'shop:books': true;
  'shop:flowers': true;
  'shop:fish': true;
  'shop:tailor': true;
  'shop:cheese': true;
  'shop:toys': true;
  'plank-walls': true; //    stilt house (R-H04)
  'in-row': true; //         row house (R-H11): eaves align with the neighbours
  'over-water': true; //     stands on stilts or a dock
  'has-steeple': true; //    chapel paired with a tower (R-H01)
  'second-gallery': true; // lighthouse ≥ 6 tall (R-L01)
  'creepers': true; //       garden wall (R-E02)
  'raised': true; //         windmill on a tower or house stack (R-W01)
}

// ───────────────────────────────────────────────────── derived helper types ──

type Keys<R> = Extract<keyof R, string>;
/** The plain type names in a registry (keys with no '/' or '.'). */
export type TypesIn<R> = {
  [K in Keys<R>]: K extends `${string}/${string}` | `${string}.${string}` ? never : K;
}[Keys<R>];
/** The variants registered for type T (never if it has none). */
export type VariantsIn<R, T extends string> = {
  [K in Keys<R>]: K extends `${T}/${infer V}` ? V : never;
}[Keys<R>];
/** The params object for type T; every param optional. */
export type ParamsIn<R, T extends string> = {
  [K in Keys<R> as K extends `${T}.${infer P}` ? P : never]?: R[K];
};

export type FeatureType = TypesIn<FeatureVocab>;
export type FeatureVariant<T extends FeatureType = FeatureType> = VariantsIn<FeatureVocab, T>;
export type FeatureParams<T extends FeatureType = FeatureType> = ParamsIn<FeatureVocab, T>;

export type PropType = TypesIn<PropVocab>;
export type PropVariant<T extends PropType = PropType> = VariantsIn<PropVocab, T>;
export type PropParams<T extends PropType = PropType> = ParamsIn<PropVocab, T>;

export type ActorType = TypesIn<ActorVocab>;
export type ActorVariant<T extends ActorType = ActorType> = VariantsIn<ActorVocab, T>;
export type ActorParams<T extends ActorType = ActorType> = ParamsIn<ActorVocab, T>;

export type SocketType = Keys<SocketVocab>;
export type Role = Keys<RoleVocab>;
export type Tag = Keys<TagVocab>;
/** The roles that apply to a given structure kind. */
export type RolesOf<K extends string> = { [R in Role]: RoleVocab[R] extends K ? R : never }[Role];
