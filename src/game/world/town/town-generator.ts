import { Biome } from '@game/world/biome';
import { Block, STOREY_H, Top, WallSide } from '@game/world/blocks';
import { openDoorway, openRandomWindows } from '@game/world/building/openings';
import { randomWallCell, sameCell, type BuildingPlan, type Cell, type WallCell } from '@game/world/building/plan';
import { buildPartition, raiseShell } from '@game/world/building/shell';
import { STAIRS_WALL_MIN, buildStairs } from '@game/world/building/stairs';
import { createRandom, type RandomInt } from '@game/world/random';
import { World, type GeneratedWorld } from '@game/world/world';

const WINDOW_PERCENT = 25; // chance of a window in a wall cell, corners excluded
const WINDOWS_MIN = 4; // per storey, so that no house is a dark box
const WORLD_SIZE = 44;
const WORLD_HEIGHT = 6; // enough for two storeys: the roof slab is on the cell 2 * STOREY_H = 4
const SPAWN_CLEARING = 4; // half-size of the building-free square around the spawn
const RESERVED = 255; // temporary building id that keeps the spawn clearing free
const HOUSES_MAX = 8;
const HOUSE_ATTEMPTS = 100;
const TWO_STOREY_CHANCE = 0.4;
const ONE_STOREY_WALL_MIN = 6;
const PARTITION_WIDTH_MIN = 9; // a one-storey house this wide gets a partition wall
const ROCKS = 40; // places tried for a rock
const TALL_ROCK_CHANCE = 0.4; // a rock of two blocks, not one

function isFree(world: World, x: number, z: number, w: number, d: number): boolean {
  for (let cz = z; cz < z + d; cz++) {
    for (let cx = x; cx < x + w; cx++) {
      if (world.buildingAt(cx, cz) !== 0) return false;
    }
  }
  return true;
}

function fillColumns(world: World, x: number, z: number, w: number, d: number, id: number): void {
  for (let cz = z; cz < z + d; cz++) {
    for (let cx = x; cx < x + w; cx++) world.setBuilding(cx, cz, id);
  }
}

function buildHouse(world: World, id: number, house: BuildingPlan, int: RandomInt): void {
  const { x0, z0, w, d, storeys } = house;
  const z1 = z0 + d - 1;

  raiseShell(world, id, house);

  // One-storey wide houses get a partition wall (on the west edge of its column, from wall to wall) with a doorway.
  const partitionX = storeys === 1 && w >= PARTITION_WIDTH_MIN ? x0 + Math.floor(w / 2) : null;
  if (partitionX !== null) buildPartition(world, { vertical: true, line: partitionX, from: z0, to: z1 }, int);

  const stairs = storeys === 2 ? buildStairs(world, house, int) : [];
  const onStairs = (cell: Cell): boolean => stairs.some((step) => sameCell(step, cell)); // the wall behind the stairwell stays whole

  // Door = missing wall slabs, on any wall but not where the stairs or the partition are.
  let door: WallCell;
  do {
    door = randomWallCell(house, int);
  } while (door.x === partitionX || onStairs(door));
  openDoorway(world, door.x, door.z, door.side);
  world.doors.push({ building: id, x: door.x, z: door.z, side: door.side });

  // Windows in every storey. The ground floor has none behind the stairs or in the door.
  for (let s = 0; s < storeys; s++) {
    openRandomWindows(world, house, s, int, {
      percent: WINDOW_PERCENT,
      min: WINDOWS_MIN,
      excluded: (cell) => s === 0 && (sameCell(cell, door) || onStairs(cell)),
    });
  }
}

// The town: an open plain with grass, houses of one or two storeys with a door, windows, partition walls and stairs, and rocks.
// The player starts in a clearing at the middle.
export function generateTown(seed: number): GeneratedWorld {
  const { rand, int } = createRandom(seed);
  const world = new World(WORLD_SIZE, WORLD_HEIGHT, WORLD_SIZE);
  const center = WORLD_SIZE / 2;

  for (let z = 0; z < WORLD_SIZE; z++) {
    for (let x = 0; x < WORLD_SIZE; x++) world.setTop(x, 0, z, Top.Grass);
  }

  fillColumns(world, center - SPAWN_CLEARING, center - SPAWN_CLEARING, SPAWN_CLEARING * 2, SPAWN_CLEARING * 2, RESERVED);

  let houseCount = 0;
  for (let attempt = 0; attempt < HOUSE_ATTEMPTS && houseCount < HOUSES_MAX; attempt++) {
    const storeys = rand() < TWO_STOREY_CHANCE ? 2 : 1;
    const min = storeys === 2 ? STAIRS_WALL_MIN : ONE_STOREY_WALL_MIN; // two storeys: a wall long enough for the stairs on every side
    const w = int(min, 11);
    const d = int(min, 9);
    const x0 = int(2, WORLD_SIZE - w - 3);
    const z0 = int(2, WORLD_SIZE - d - 3);
    if (!isFree(world, x0 - 2, z0 - 2, w + 4, d + 4)) continue;
    buildHouse(world, ++houseCount, { x0, z0, w, d, storeys }, int);
  }

  for (let n = 0; n < ROCKS; n++) {
    const x = int(1, WORLD_SIZE - 2);
    const z = int(1, WORLD_SIZE - 2);
    if (!isFree(world, x - 1, z - 1, 3, 3)) continue;
    world.set(x, 1, z, Block.Rock);
    if (rand() < TALL_ROCK_CHANCE) world.set(x, 2, z, Block.Rock);
  }

  fillColumns(world, center - SPAWN_CLEARING, center - SPAWN_CLEARING, SPAWN_CLEARING * 2, SPAWN_CLEARING * 2, 0);

  return { world, spawn: { x: center + 0.5, z: center + 0.5 }, biome: Biome.Surface, population: { nodes: [], creatures: [] } };
}
