import { STOREY_H } from '@game/world/blocks';
import type { BuildingPlan } from '@game/world/building/plan';
import { buildPartition, raiseShell } from '@game/world/building/shell';
import { createRandom, type Random } from '@game/world/random';
import { World, type GeneratedWorld } from '@game/world/world';

const HALL_WIDTH = { min: 30, max: 44 };
const HALL_DEPTH = { min: 24, max: 34 };
const WORLD_HEIGHT = 2 * STOREY_H; // the roof slab is on the cell STOREY_H, and a storey of room above it
const BUILDING_ID = 1;
const ROOM_MIN = 5; // the shortest side of a room, in cells
const ROOM_AREA_MAX = 80; // a bigger room is always divided
const DIVIDE_CHANCE = 0.5; // a smaller one is divided sometimes

// A room: a rectangle of cells, x0..x0 + w - 1 by z0..z0 + d - 1.
interface Room {
  x0: number;
  z0: number;
  w: number;
  d: number;
}

// Divides the room by a wall with a doorway, and the two halves again, until the rooms are of the size wanted. Every wall
// is whole from wall to wall and has its own doorway, so any two rooms are joined by a chain of doorways: the rooms
// are all connected by construction. The rooms that are left are added to `rooms`.
function divide(world: World, room: Room, random: Random, rooms: Room[]): void {
  const { rand, int } = random;
  const canCutAcross = room.w >= 2 * ROOM_MIN; // by a wall across its width
  const canCutAlong = room.d >= 2 * ROOM_MIN;
  const mustCut = room.w * room.d > ROOM_AREA_MAX;
  if ((!canCutAcross && !canCutAlong) || (!mustCut && rand() >= DIVIDE_CHANCE)) {
    rooms.push(room);
    return;
  }

  // The longer side is cut, so that the rooms do not come out as strips.
  const vertical = canCutAcross && (!canCutAlong || room.w > room.d || (room.w === room.d && rand() < 0.5));
  if (vertical) {
    const line = int(room.x0 + ROOM_MIN, room.x0 + room.w - ROOM_MIN);
    const to = room.z0 + room.d - 1;
    buildPartition(world, { vertical, line, from: room.z0, to }, int);
    divide(world, { ...room, w: line - room.x0 }, random, rooms);
    divide(world, { ...room, x0: line, w: room.x0 + room.w - line }, random, rooms);
  } else {
    const line = int(room.z0 + ROOM_MIN, room.z0 + room.d - ROOM_MIN);
    const to = room.x0 + room.w - 1;
    buildPartition(world, { vertical, line, from: room.x0, to }, int);
    divide(world, { ...room, d: line - room.z0 }, random, rooms);
    divide(world, { ...room, z0: line, d: room.z0 + room.d - line }, random, rooms);
  }
}

// The depot: one big hall and nothing around it, the world is exactly as big as the building. Inside, walls divide it into
// rooms, joined by doorways; the outer wall is whole, without windows, and there is no entrance. The player starts in one of the rooms.
export function generateDepot(seed: number): GeneratedWorld {
  const random = createRandom(seed);
  const { int } = random;
  const w = int(HALL_WIDTH.min, HALL_WIDTH.max);
  const d = int(HALL_DEPTH.min, HALL_DEPTH.max);
  const world = new World(w, WORLD_HEIGHT, d);
  const hall: BuildingPlan = { x0: 0, z0: 0, w, d, storeys: 1 };
  raiseShell(world, BUILDING_ID, hall);

  const rooms: Room[] = [];
  divide(world, { x0: 0, z0: 0, w, d }, random, rooms);

  const start = rooms[int(0, rooms.length - 1)];
  return { world, spawn: { x: start.x0 + Math.floor(start.w / 2) + 0.5, z: start.z0 + Math.floor(start.d / 2) + 0.5 } };
}
