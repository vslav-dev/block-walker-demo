import { wallSideByBit } from '@game/world/blocks';

// A door is plainly visible from the camera once the camera is this many blocks in front of its wall.
// The camera looks across the house from one side, so only doors in the walls facing it are seen. With the camera looking
// north, the doors in the south wall are always seen, in the west and east walls only from their side of the house,
// and in the north wall never.
const VISIBLE_FROM = 4;

// A beacon only matters to a player who has taken an interest in the house, that is, has come near its walls, wherever
// the door is: it is invisible from this many blocks from the house and grows to full strength by the nearer distance.
// At the door itself it is dimmed again: there is nothing to hint at any more, and its mat would tint the player standing on it.
const BEACON_NONE_FROM_HOUSE = 4;
const BEACON_FULL_FROM_HOUSE = 3;
const BEACON_FULL_FROM_DOOR = 2;
const BEACON_NONE_FROM_DOOR = 1;

// The footprint of a building: the rectangle of cells x0..x1, z0..z1 (inclusive).
export interface Footprint {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

// How far a point is from the footprint of a building, in blocks, 0 inside it. The distance is that to its nearest point,
// so it is the same along a whole wall.
export function footprintDistance(b: Footprint, x: number, z: number): number {
  return Math.hypot(Math.max(b.x0 - x, 0, x - (b.x1 + 1)), Math.max(b.z0 - z, 0, z - (b.z1 + 1)));
}

// How much of its hint the beacon of a door shows, from 0 to 1, to a player this far from the house and from the door.
export function beaconProximity(houseDistance: number, doorDistance: number): number {
  const approach = (BEACON_NONE_FROM_HOUSE - houseDistance) / (BEACON_NONE_FROM_HOUSE - BEACON_FULL_FROM_HOUSE);
  const arrival = (doorDistance - BEACON_NONE_FROM_DOOR) / (BEACON_FULL_FROM_DOOR - BEACON_NONE_FROM_DOOR);
  return Math.min(1, Math.max(0, Math.min(approach, arrival)));
}

// How much the door needs a hint, from 0 (the camera sees it well) to 1 (it is on the far or the edge-on side of its wall).
export function doorHint(door: { x: number; z: number; side: number }, cameraX: number, cameraZ: number): number {
  const side = wallSideByBit(door.side);
  const facing = (cameraX - (door.x + 0.5)) * side.dx + (cameraZ - (door.z + 0.5)) * side.dz; // blocks in front of the wall
  return 1 - Math.min(1, Math.max(0, facing / VISIBLE_FROM));
}
