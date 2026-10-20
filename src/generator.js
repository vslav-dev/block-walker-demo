import { Block, Opening, STOREY_H, Top, WALL_SIDES, WallSide, frameValue } from './blocks.js';
import { World } from './world.js';

const WINDOW_PERCENT = 25; // chance of a window in a wall cell, corners excluded
const WINDOWS_MIN = 4; // per storey, so that no house is a dark box
const WORLD_SIZE = 44;
const WORLD_HEIGHT = 6; // enough for two storeys: the roof slab is on the cell 2 * STOREY_H = 4
const SPAWN_CLEARING = 4; // half-size of the building-free square around the spawn
const RESERVED = 255; // temporary building id that keeps the spawn clearing free

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isFree(world, x, z, w, d) {
  for (let cz = z; cz < z + d; cz++) {
    for (let cx = x; cx < x + w; cx++) {
      if (world.buildingAt(cx, cz) !== 0) return false;
    }
  }
  return true;
}

function fillColumns(world, x, z, w, d, id) {
  for (let cz = z; cz < z + d; cz++) {
    for (let cx = x; cx < x + w; cx++) world.setBuilding(cx, cz, id);
  }
}

// A wall is addressed by its index in WALL_SIDES (0 = north, 1 = south, 2 = west, 3 = east) and a cell on it by the
// distance u from its first corner: 0..length - 1 towards +x on the north and south walls, towards +z on the others.
const wallLength = ({ w, d }, index) => (index < 2 ? w : d);

function wallCell({ x0, z0, w, d }, index, u) {
  if (index === 0) return { x: x0 + u, z: z0 };
  if (index === 1) return { x: x0 + u, z: z0 + d - 1 };
  if (index === 2) return { x: x0, z: z0 + u };
  return { x: x0 + w - 1, z: z0 + u };
}

// Random cell on a random wall, corners excluded. `side` is the WallSide of the slab that sits in this cell.
function randomWallCell(house, int) {
  const index = int(0, 3);
  return { ...wallCell(house, index, int(1, wallLength(house, index) - 2)), side: WALL_SIDES[index].bit };
}

const sameCell = (a, b) => a.x === b.x && a.z === b.z;

// A doorway on the ground floor: the slabs of both rows of the wall are taken out of the cell, nothing is felt of the door.
// The frame in it (lowest row) is drawn: posts, a header and a strip of wall over it, see DOOR_H.
function openDoorway(world, x, z, side) {
  for (let y = 1; y <= STOREY_H; y++) world.removeWalls(x, y, z, side);
  world.setFrame(x, 1, z, frameValue(side, Opening.Door));
}

// A window in a storey: the slab of the upper row is taken out of the cell, the lower one stays as the parapet. The frame
// (lowest row) is drawn from WINDOW_BOTTOM to WINDOW_TOP, which does not follow the rows.
function openWindow(world, x, storey, z, side) {
  const base = storey * STOREY_H;
  world.removeWalls(x, base + STOREY_H, z, side);
  world.setFrame(x, base + 1, z, frameValue(side, Opening.Window));
}

// Stairs run along a wall: a flight of STOREY_H cells with a landing at each end, and a corner cell beyond each landing.
const STAIRS_WALL_MIN = STOREY_H + 4;

// Solid stairs in the cells of a random wall, rising along it in a random direction, docked to the wall.
// The upper floor has a hole above them, and its last step is level with it. The hole reaches over the landing at the
// foot too: a step is as high as it is long, so a head 1.7 blocks high meets a floor 2 blocks up before the stairs
// are under the hole. Returns the cells of the stairwell, the landing at the foot and the flight: the wall behind them stays whole.
function buildStairs(world, house, int) {
  const index = int(0, 3);
  const first = int(2, wallLength(house, index) - STOREY_H - 2); // u of the lowest u of the flight
  const rising = int(0, 1) === 1; // towards higher u
  const direction = (index < 2 ? 0 : 1) + (rising ? 0 : 2); // in StairDir order: +x, +z, -x, -z
  const cellAt = (step) => wallCell(house, index, rising ? first + step : first + STOREY_H - 1 - step); // step -1 = the landing at the foot
  const foot = cellAt(-1);
  world.setTop(foot.x, STOREY_H, foot.z, Top.None);
  const cells = [foot];
  for (let step = 0; step < STOREY_H; step++) {
    const { x, z } = cellAt(step);
    for (let j = 1; j <= step; j++) world.set(x, j, z, Block.Planks);
    world.set(x, 1 + step, z, Block.Stairs + direction);
    world.setTop(x, STOREY_H, z, Top.None);
    cells.push({ x, z });
  }
  return cells;
}

function buildHouse(world, id, house, int) {
  const { x0, z0, w, d, storeys } = house;
  const x1 = x0 + w - 1;
  const z1 = z0 + d - 1;
  const roofY = storeys * STOREY_H; // the roof is the top slab of the highest cell of the walls

  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      world.setBuilding(x, z, id);
      const sides = (z === z0 ? WallSide.North : 0) | (z === z1 ? WallSide.South : 0)
        | (x === x0 ? WallSide.West : 0) | (x === x1 ? WallSide.East : 0);
      for (let s = 0; s < storeys; s++) {
        const base = s * STOREY_H; // the floor of the storey is the top slab of this cell, the walls are above it
        world.setTop(x, base, z, Top.Planks);
        for (let j = 1; j <= STOREY_H; j++) world.addWalls(x, base + j, z, sides);
      }
      world.setTop(x, roofY, z, Top.Roof);
    }
  }

  // One-storey wide houses get a partition wall (on the west edge of its column, from wall to wall) with a doorway.
  const partitionX = storeys === 1 && w >= 9 ? x0 + Math.floor(w / 2) : null;
  if (partitionX !== null) {
    for (let z = z0; z <= z1; z++) {
      for (let j = 1; j <= STOREY_H; j++) world.addWalls(partitionX, j, z, WallSide.West);
    }
    const gapZ = int(z0 + 1, z1 - 1);
    openDoorway(world, partitionX, gapZ, WallSide.West);
  }

  const stairs = storeys === 2 ? buildStairs(world, house, int) : [];
  const onStairs = (cell) => stairs.some((step) => sameCell(step, cell)); // the wall behind the stairwell stays whole

  // Door = missing wall slabs, on any wall but not where the stairs or the partition are.
  let door;
  do {
    door = randomWallCell(house, int);
  } while (door.x === partitionX || onStairs(door));
  openDoorway(world, door.x, door.z, door.side);
  world.doors.push({ building: id, x: door.x, z: door.z, side: door.side });

  // Windows = a missing wall slab in the upper row (the lower one stays as a parapet), in about WINDOW_PERCENT of the wall
  // cells of every storey and in at least WINDOWS_MIN of them. The ground floor has none behind the stairs or in the door.
  for (let s = 0; s < storeys; s++) {
    const candidates = [];
    for (let index = 0; index < WALL_SIDES.length; index++) {
      for (let u = 1; u < wallLength(house, index) - 1; u++) {
        const cell = { ...wallCell(house, index, u), side: WALL_SIDES[index].bit };
        if (s > 0 || !(sameCell(cell, door) || onStairs(cell))) candidates.push(cell);
      }
    }
    const windows = new Set(candidates.filter(() => int(1, 100) <= WINDOW_PERCENT));
    while (windows.size < WINDOWS_MIN) windows.add(candidates[int(0, candidates.length - 1)]);
    for (const cell of windows) openWindow(world, cell.x, s, cell.z, cell.side);
  }
}

export function generateWorld(seed) {
  const rand = mulberry32(seed);
  const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const world = new World(WORLD_SIZE, WORLD_HEIGHT, WORLD_SIZE);
  const center = WORLD_SIZE / 2;

  for (let z = 0; z < WORLD_SIZE; z++) {
    for (let x = 0; x < WORLD_SIZE; x++) world.setTop(x, 0, z, Top.Grass);
  }

  fillColumns(world, center - SPAWN_CLEARING, center - SPAWN_CLEARING, SPAWN_CLEARING * 2, SPAWN_CLEARING * 2, RESERVED);

  let houseCount = 0;
  for (let attempt = 0; attempt < 100 && houseCount < 8; attempt++) {
    const storeys = rand() < 0.4 ? 2 : 1;
    const min = storeys === 2 ? STAIRS_WALL_MIN : 6; // two storeys: a wall long enough for the stairs on every side
    const w = int(min, 11);
    const d = int(min, 9);
    const x0 = int(2, WORLD_SIZE - w - 3);
    const z0 = int(2, WORLD_SIZE - d - 3);
    if (!isFree(world, x0 - 2, z0 - 2, w + 4, d + 4)) continue;
    buildHouse(world, ++houseCount, { x0, z0, w, d, storeys }, int);
  }

  for (let n = 0; n < 40; n++) {
    const x = int(1, WORLD_SIZE - 2);
    const z = int(1, WORLD_SIZE - 2);
    if (!isFree(world, x - 1, z - 1, 3, 3)) continue;
    world.set(x, 1, z, Block.Rock);
    if (rand() < 0.4) world.set(x, 2, z, Block.Rock);
  }

  fillColumns(world, center - SPAWN_CLEARING, center - SPAWN_CLEARING, SPAWN_CLEARING * 2, SPAWN_CLEARING * 2, 0);

  return { world, spawn: { x: center + 0.5, z: center + 0.5 } };
}
