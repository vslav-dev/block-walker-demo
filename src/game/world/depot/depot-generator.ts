import { Biome } from '@game/world/biome';
import { STOREY_H } from '@game/world/blocks';
import type { BuildingPlan } from '@game/world/building/plan';
import { isDoorwayClear, openPartitionDoorway, raisePartition, raiseShell, type Partition } from '@game/world/building/shell';
import { LIGHT_HEIGHT, LightKind } from '@game/world/light';
import { createRandom, type Random } from '@game/world/random';
import { World, type GeneratedWorld } from '@game/world/world';

const HALL_WIDTH = { min: 30, max: 44 };
const HALL_DEPTH = { min: 24, max: 34 };
const WORLD_HEIGHT = 2 * STOREY_H; // the roof slab is on the cell STOREY_H, and a storey of room above it
const BUILDING_ID = 1;
const ROOM_MIN = 5; // the shortest side of a room, in cells
const ROOM_AREA_MAX = 80; // a bigger room is always divided
const DIVIDE_CHANCE = 0.5; // a smaller one is divided sometimes
const DARK_ROOM_CHANCE = 0.4; // a room without any light of its own
const LAMP_CHANCE = 0.15; // a room with a lamp; the rest of the rooms have a candle
const CANDLE_INSET = 0.25; // how far from the walls of its corner a candle stands: out of reach of the body, which a wall keeps 0.3 away
const FLOOR_Y = 1; // the plane of the floor of the ground storey

// A room: a rectangle of cells, x0..x0 + w - 1 by z0..z0 + d - 1.
interface Room {
  x0: number;
  z0: number;
  w: number;
  d: number;
}

// Divides the room by a wall, and the two halves again, until the rooms are of the size wanted. Every wall is whole from
// wall to wall and will have its own doorway (see openDoorways), so any two rooms are joined by a chain of doorways: the
// rooms are all connected by construction. The walls are added to `partitions`, the rooms that are left to `rooms`.
function divide(world: World, room: Room, random: Random, rooms: Room[], partitions: Partition[]): void {
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
    const partition = { vertical, line, from: room.z0, to: room.z0 + room.d - 1 };
    raisePartition(world, partition);
    partitions.push(partition);
    divide(world, { ...room, w: line - room.x0 }, random, rooms, partitions);
    divide(world, { ...room, x0: line, w: room.x0 + room.w - line }, random, rooms, partitions);
  } else {
    const line = int(room.z0 + ROOM_MIN, room.z0 + room.d - ROOM_MIN);
    const partition = { vertical, line, from: room.x0, to: room.x0 + room.w - 1 };
    raisePartition(world, partition);
    partitions.push(partition);
    divide(world, { ...room, d: line - room.z0 }, random, rooms, partitions);
    divide(world, { ...room, z0: line, d: room.z0 + room.d - line }, random, rooms, partitions);
  }
}

// A doorway in every wall, where no other wall meets it: when all of them are raised it is known which cells have such walls
// at their edges. One doorway in a wall, so the rooms are joined as divide says.
function openDoorways(world: World, partitions: readonly Partition[], { int }: Random): void {
  for (const partition of partitions) openPartitionDoorway(world, partition, int, (t) => isDoorwayClear(world, partition, t));
}

// Lights some of the rooms: a lamp hangs over the middle of a room, a candle stands in one of its corners. Rooms with neither
// are dark. It is done after the layout and the start have been chosen, so the layout of a seed does not depend on the lights.
function lightRooms(world: World, rooms: readonly Room[], { rand, int }: Random): void {
  for (const { x0, z0, w, d } of rooms) {
    const roll = rand();
    if (roll < DARK_ROOM_CHANCE) continue;
    if (roll >= 1 - LAMP_CHANCE) {
      world.lights.push({ kind: LightKind.Lamp, x: x0 + w / 2, y: FLOOR_Y + LIGHT_HEIGHT[LightKind.Lamp], z: z0 + d / 2 });
      continue;
    }
    const corner = int(0, 3);
    const x = corner & 1 ? x0 + w - CANDLE_INSET : x0 + CANDLE_INSET;
    const z = corner & 2 ? z0 + d - CANDLE_INSET : z0 + CANDLE_INSET;
    world.lights.push({ kind: LightKind.Candle, x, y: FLOOR_Y + LIGHT_HEIGHT[LightKind.Candle], z });
  }
}

// The depot: one big hall and nothing around it, the world is exactly as big as the building. Inside, walls divide it into
// rooms, joined by doorways; the outer wall is whole, without windows, and there is no entrance. The player starts in one of the rooms.
// It is an interior: nothing shines but the lamps and the candles that some of the rooms have.
export function generateDepot(seed: number): GeneratedWorld {
  const random = createRandom(seed);
  const { int } = random;
  const w = int(HALL_WIDTH.min, HALL_WIDTH.max);
  const d = int(HALL_DEPTH.min, HALL_DEPTH.max);
  const world = new World(w, WORLD_HEIGHT, d);
  const hall: BuildingPlan = { x0: 0, z0: 0, w, d, storeys: 1 };
  raiseShell(world, BUILDING_ID, hall);

  const rooms: Room[] = [];
  const partitions: Partition[] = [];
  divide(world, { x0: 0, z0: 0, w, d }, random, rooms, partitions);
  openDoorways(world, partitions, random);

  const start = rooms[int(0, rooms.length - 1)];
  lightRooms(world, rooms, random);
  return {
    world,
    spawn: { x: start.x0 + Math.floor(start.w / 2) + 0.5, z: start.z0 + Math.floor(start.d / 2) + 0.5 },
    biome: Biome.Interior,
  };
}
