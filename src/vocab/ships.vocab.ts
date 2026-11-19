// Vocabulary for the big ships (catalogue L38–L42). Types only.
//
// A rule says only that a ship CALLS at a town: a `ship-call` actor (at =
// null) naming the ship and its berth. The harbour system
// (src/life/ships/harbour.system.ts) sails it: it spawns the hull, sails,
// flags, oars and crew as instances of their own, so a ship can finish its
// visit (cast off, sail away) after the berth it came for has gone. A call
// anchored to a cell is a still life for the gallery: the ship lies there.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface ActorVocab {
    'ship-call': true;
    'ship-call/galleon': true; // L38
    'ship-call/cog': true; //     L39
    'ship-call/galley': true; //  L40
    'ship-call/barge': true; //   L41
    'ship-call/passing': true; // L42: a tall ship far out, never calling
    'ship-call.look': number; //  paint, sails, flag and figurehead (seeded)
    // The berth (berths.fact.ts): the first quay cell of its run, the way the run goes, its length, the water side.
    'ship-call.x': number;
    'ship-call.z': number;
    'ship-call.along': number; // Dir4
    'ship-call.cells': number;
    'ship-call.out': number; //   Dir4
    'ship-call.dir': number; //   the way the ship lies: bow along the run (1) or against it (−1)
    // L41: the second dock, by its berth cell.
    'ship-call.x2': number;
    'ship-call.z2': number;
    // Gallery only (anchored calls): how far the sails are set (0 furled, 1 full) and the heel.
    'ship-call.set': number;

    // The drawn pieces, spawned by the harbour system. Frame: afloat, +Z the bow, y = 0 the waterline.
    'galleon': true;
    'galleon.look': number;
    'cog': true;
    'cog.look': number;
    'galley': true;
    'galley.look': number;
    'barge': true;
    'barge.look': number;
    'barge.load': number; // 0 sacks, 1 hay, 2 barrels
    // A sail, or the yard it is furled on. Frame: the middle of its yard, on the mast's fore side.
    'ship-sail': true;
    'ship-sail/cloth': true; //  the cloth, hanging from the yard (scaled down to furl it)
    'ship-sail/yard': true; //   the yard with the sail furled along it
    'ship-sail.ship': number; // ShipKind index (rig.ts)
    'ship-sail.sail': number; // which sail of that ship's rig
    'ship-sail.look': number;
    'ship-sail.side': number; // fore-and-aft sails: which way the belly is built (1 or −1)
    // A pennant or ensign, turned downwind by the system. Frame: where it is bent on, +Z the fly.
    'ship-flag': true;
    'ship-flag/pennant': true;
    'ship-flag/ensign': true;
    'ship-flag.look': number;
    'ship-flag.length': number;
    // L40: a bank of oars along one side, moved as one (rig.ts says where the tholes are).
    'ship-oars': true;
    'ship-oars.side': number;
    'ship-oars.look': number;
    // The plank from the ship's side down to the quay. Frame: its foot on the quay, +Z up to the ship.
    'gangplank': true;
    'gangplank.length': number;
    // What the crew bring ashore: one crate, barrel or sack, carried and then piled on the quay.
    'ship-goods': true;
    'ship-goods/crate': true;
    'ship-goods/barrel': true;
    'ship-goods/sack': true;
    'ship-goods.look': number;
  }
  interface SocketVocab {
    // Where residents stand to watch a ship at its berth (L38–L40): a deck or quay cell beside the berth,
    // `dir` toward the water. Chosen by the crowd only while a ship is in (harbour.system.ts).
    'haunt-ship': true;
  }
}
