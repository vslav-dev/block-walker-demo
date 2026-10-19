import { WALL_SIDES } from './blocks.js';

// A door is plainly visible from the camera once the camera is this many blocks in front of its wall.
// The camera looks north from the south, so doors in the south wall are always seen, doors in the west and east walls
// only from their side of the house, and doors in the north wall never.
const VISIBLE_FROM = 4;

// How much the door needs a hint, from 0 (the camera sees it well) to 1 (it is on the far or the edge-on side of its wall).
export function doorHint(door, cameraX, cameraZ) {
  const side = WALL_SIDES.find((s) => s.bit === door.side);
  const facing = (cameraX - (door.x + 0.5)) * side.dx + (cameraZ - (door.z + 0.5)) * side.dz; // blocks in front of the wall
  return 1 - Math.min(1, Math.max(0, facing / VISIBLE_FROM));
}
