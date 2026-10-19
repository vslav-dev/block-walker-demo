import test from 'node:test';
import assert from 'node:assert/strict';
import { Block, DOOR_H, STOREY_H, StairDir, Top, WALL_SIDES, WALL_THICKNESS, WallSide, frameHasHeader, frameHasSill, frameSide, isStairs, storeyAt } from '../src/blocks.js';
import { World } from '../src/world.js';
import { PlayerBody, RADIUS, RUN_SPEED, WALL_REACH } from '../src/player.js';
import { generateWorld } from '../src/generator.js';
import { doorHint } from '../src/door-hint.js';

const DT = 1 / 60;
const GRID_STEP = 0.1;
const SEEDS = [1, 2, 3, 42, 777];
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [0, 0]].map(([x, z]) => [x, z].map((v) => v * Math.SQRT1_2 ** Math.abs(x * z)));

function flatWorld() {
  const world = new World(8, 8, 8);
  for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) world.setTop(x, 0, z, Top.Grass);
  return world;
}

function walk(body, vx, vz, seconds) {
  for (let t = 0; t < seconds; t += DT) body.update(DT, vx, vz);
}

// Every staircase: its first (lowest) step, the direction it rises to, the wall it is docked to and its cells.
function staircases(world) {
  const found = [];
  for (let z = 0; z < world.sizeZ; z++) {
    for (let x = 0; x < world.sizeX; x++) {
      const id = world.get(x, 1, z);
      if (!isStairs(id)) continue;
      const dir = StairDir[id - Block.Stairs];
      const wall = WALL_SIDES.find((side) => (world.getWalls(x, 1, z) & side.bit) !== 0);
      const cells = Array.from({ length: STOREY_H }, (_, i) => ({ x: x + dir.x * i, z: z + dir.z * i }));
      found.push({ x, z, dir, wall, cells });
    }
  }
  return found;
}

// A point on the ground floor in front of the stairs, `offset` blocks away from the wall they are docked to.
function atFootOfStairs({ x, z, dir, wall }, offset) {
  const foot = { x: x - dir.x + 0.5, z: z - dir.z + 0.5 };
  if (wall.dz !== 0) foot.z = (wall.dz < 0 ? z : z + 1) - wall.dz * offset;
  else foot.x = (wall.dx < 0 ? x : x + 1) - wall.dx * offset;
  return foot;
}

// A wall along the west edge of column 4, with a doorway at z=6.
function wallWorld() {
  const world = flatWorld();
  for (let z = 0; z < 8; z++) for (let j = 1; j <= 3; j++) world.addWalls(4, j, z, WallSide.West);
  world.removeWalls(4, 1, 6, WallSide.West);
  world.removeWalls(4, 2, 6, WallSide.West);
  return world;
}

test('a wall blocks the player, a door gap lets them through', () => {
  const world = wallWorld();

  const blocked = new PlayerBody(world, 1.5, 2.5);
  walk(blocked, 3, 0, 3);
  assert.ok(blocked.x <= 4 - WALL_REACH + 1e-6, `stopped at the wall, got x=${blocked.x}`);

  const through = new PlayerBody(world, 1.5, 6.5);
  walk(through, 3, 0, 2);
  assert.ok(through.x > 5, `passed the doorway, got x=${through.x}`);
});

test('a wall is only as thick as a slab: the rest of its cell is walkable', () => {
  const world = wallWorld();
  const body = new PlayerBody(world, 6.5, 2.5);
  walk(body, -3, 0, 3);
  const face = 4 + WALL_THICKNESS + WALL_REACH;
  assert.ok(body.x >= face - 1e-6 && body.x < face + 0.1, `stopped at the slab face, got x=${body.x}`);
});

test('a thin wall is not tunneled through, even in a long frame', () => {
  const world = wallWorld();
  for (const [from, vx] of [[1.5, RUN_SPEED], [6.5, -RUN_SPEED]]) {
    const body = new PlayerBody(world, from, 2.5);
    for (let t = 0; t < 2; t += 0.05) body.update(0.05, vx, 0);
    assert.equal(Math.sign(body.x - 4), Math.sign(from - 4), `stayed on its side, got x=${body.x}`);
  }
});

test('a 1-block cube is an obstacle, not a step', () => {
  const world = flatWorld();
  world.set(2, 1, 2, Block.Planks); // 1-block ledge, too high to step on
  const body = new PlayerBody(world, 1.5, 2.5);
  walk(body, 3, 0, 1);
  assert.ok(body.x < 2 - RADIUS + 1e-6, 'a 1-block cube is an obstacle');
  assert.equal(body.y, 1);
});

test('walking into the edge of an obstacle slides round it, walking into its middle stops', () => {
  const world = flatWorld();
  world.set(4, 1, 2, Block.Planks); // the cube covers x 4..5, z 2..3

  for (const [z, side] of [[2.0, -1], [2.1, -1], [3.0, 1], [2.9, 1]]) { // half on the cube, half beside it
    const body = new PlayerBody(world, 1.5, z);
    walk(body, 3, 0, 3);
    assert.ok(body.x > 5.5, `passed the cube, got x=${body.x} from z=${z}`);
    assert.equal(Math.sign(body.z - z), side, `was pushed to the free side, got z=${body.z} from z=${z}`);
  }

  const middle = new PlayerBody(world, 1.5, 2.5);
  walk(middle, 3, 0, 3);
  assert.ok(middle.x < 4 - RADIUS + 1e-6, 'still stops in front of the middle of the cube');
  assert.equal(middle.z, 2.5);

  // The same from the other three sides: [start x, start z, vx, vz].
  for (const [x, z, vx, vz] of [[6.5, 2.0, -3, 0], [4.0, 4.5, 0, -3], [4.0, 0.5, 0, 3], [4.9, 0.5, 0, 3]]) {
    const body = new PlayerBody(world, x, z);
    walk(body, vx, vz, 3);
    assert.ok(Math.hypot(body.x - x, body.z - z) > 3, `passed the cube from (${x}, ${z}), got (${body.x}, ${body.z})`);
  }
});

test('a doorway is found when the body is a little off its middle', () => {
  const world = wallWorld(); // the doorway is z 6..7
  for (const z of [6.2, 6.8]) {
    const body = new PlayerBody(world, 1.5, z);
    walk(body, 3, 0, 3);
    assert.ok(body.x > 5, `passed the doorway from z=${z}, got x=${body.x}`);
  }
});

test('a floor is a plane to stand on, and a ceiling blocks the head only when it gets there', () => {
  const world = flatWorld();
  for (let z = 0; z < 8; z++) for (let x = 4; x < 8; x++) world.setTop(x, 2, z, Top.Planks); // a ceiling over x >= 4, plane y=3

  assert.equal(world.groundAt(1.5, 1.5, 1), 1, 'the ground is the plane at y=1');
  assert.equal(world.groundAt(5.5, 1.5, 1), 1, 'a ceiling is no ground');

  const under = new PlayerBody(world, 1.5, 2.5);
  walk(under, 3, 0, 3); // the head is 1.7 high, the slab starts at 2.9 above the ground plane at 1: it fits
  assert.ok(under.x > 6, `walked under the ceiling, got x=${under.x}`);

  const low = flatWorld();
  for (let z = 0; z < 8; z++) for (let x = 4; x < 8; x++) low.setTop(x, 1, z, Top.Planks); // plane y=2, the slab starts at 1.9
  const blocked = new PlayerBody(low, 1.5, 2.5);
  walk(blocked, 3, 0, 3);
  assert.ok(blocked.x < 4 - RADIUS + 1e-6, `a low ceiling stops the head, got x=${blocked.x}`);
});

test('the view switches to the next storey two blocks up the stairs, not at its floor', () => {
  assert.equal(STOREY_H, 3, 'the numbers below assume 3 blocks per storey');
  // Floors are at y = 1, 4, 7.
  for (const [y, storey] of [[1, 0], [2.9, 0], [3, 1], [4, 1], [5.9, 1], [6, 2], [7, 2]]) {
    assert.equal(storeyAt(y), storey, `storey at y=${y}`);
  }
});

test('every building has exactly one entrance, a door-sized gap in its wall', () => {
  for (const seed of SEEDS) {
    const { world } = generateWorld(seed);
    const buildings = new Set(world.buildings.filter((id) => id !== 0));
    assert.equal(world.doors.length, buildings.size, `seed ${seed}: one door per building`);
    for (const door of world.doors) {
      assert.equal(world.buildingAt(door.x, door.z), door.building, 'the door is in its building');
      for (let y = 1; y <= DOOR_H; y++) assert.equal(world.getWalls(door.x, y, door.z) & door.side, 0, `gap at y=${y}`);
      assert.notEqual(world.getWalls(door.x, DOOR_H + 1, door.z) & door.side, 0, 'the lintel stays');
    }
  }
});

test('buildings have plenty of windows: gaps at eye level under and over wall that stays', () => {
  for (const seed of SEEDS) {
    const { world } = generateWorld(seed);
    const windows = new Map(); // building id -> number of windows on the ground floor
    for (let z = 0; z < world.sizeZ; z++) {
      for (let x = 0; x < world.sizeX; x++) {
        for (const side of WALL_SIDES) {
          const has = (y) => (world.getWalls(x, y, z) & side.bit) !== 0;
          if (has(1) && !has(2) && has(3)) windows.set(world.buildingAt(x, z), (windows.get(world.buildingAt(x, z)) ?? 0) + 1);
        }
      }
    }
    const buildings = new Set(world.buildings.filter((id) => id !== 0));
    for (const id of buildings) assert.ok((windows.get(id) ?? 0) >= 3, `seed ${seed}: building ${id} has ${windows.get(id) ?? 0} windows`);
  }
});

test('doors and windows are framed: posts at the sides, a header over them, a sill only under windows', () => {
  for (const seed of SEEDS) {
    const { world } = generateWorld(seed);
    for (const door of world.doors) {
      for (let y = 1; y <= DOOR_H; y++) {
        const frame = world.getFrame(door.x, y, door.z);
        assert.equal(frameSide(frame), door.side, 'the frame is in the wall of the door');
        assert.equal(frameHasHeader(frame), y === DOOR_H, `header only over the doorway (y=${y})`);
        assert.equal(frameHasSill(frame), false, 'no sill under a door');
      }
    }

    for (let z = 0; z < world.sizeZ; z++) {
      for (let x = 0; x < world.sizeX; x++) {
        for (const side of WALL_SIDES) {
          const has = (y) => (world.getWalls(x, y, z) & side.bit) !== 0;
          if (!(has(1) && !has(2) && has(3))) continue; // a window
          const frame = world.getFrame(x, 2, z);
          assert.ok(frameSide(frame) === side.bit && frameHasHeader(frame) && frameHasSill(frame), `window (${x}, ${z}) is framed all around`);
        }
      }
    }
  }
});

test('a door needs a hint when the camera cannot see its wall: always in the north one, never in the south one', () => {
  const at = (side) => ({ x: 10, z: 10, side });
  const camera = { x: 10.5, z: 26 }; // the camera is far to the south, level with the door
  assert.equal(doorHint(at(WallSide.North), camera.x, camera.z), 1, 'north: never seen');
  assert.equal(doorHint(at(WallSide.South), camera.x, camera.z), 0, 'south: always seen');
  assert.equal(doorHint(at(WallSide.West), camera.x, camera.z), 1, 'west, seen edge-on');
  assert.equal(doorHint(at(WallSide.West), 10.5 - 6, camera.z), 0, 'west, from the west');
  assert.equal(doorHint(at(WallSide.East), 10.5 - 6, camera.z), 1, 'east, from the west: the other side');
  assert.equal(doorHint(at(WallSide.East), 10.5 + 2, camera.z), 0.5, 'east, half way to a good view');
});

test('the tested seeds contain staircases', () => {
  assert.ok(SEEDS.some((seed) => staircases(generateWorld(seed).world).length > 0));
});

for (const seed of SEEDS) {
  test(`seed ${seed}: every building is enterable`, () => {
    const { world, spawn } = generateWorld(seed);
    assert.equal(world.groundAt(spawn.x, spawn.z, 1), 1, 'spawn is on the ground');

    // Flood fill the ground floor from the spawn on a grid much finer than the walls are thick.
    // Grid points sit at odd multiples of 0.05, so the player's edges never coincide with a wall face.
    const N = Math.round(world.sizeX / GRID_STEP);
    const point = (i) => (i + 0.5) * GRID_STEP;
    const probe = new PlayerBody(world, spawn.x, spawn.z);
    const reached = new Uint8Array(N * N);
    const queue = [[Math.floor(spawn.x / GRID_STEP), Math.floor(spawn.z / GRID_STEP)]];
    while (queue.length) {
      const [i, k] = queue.pop();
      if (i < 0 || k < 0 || i >= N || k >= N || reached[i + k * N] || !probe.canStand(point(i), point(k))) continue;
      reached[i + k * N] = 1;
      queue.push([i + 1, k], [i - 1, k], [i, k + 1], [i, k - 1]);
    }

    assert.ok(reached.reduce((sum, v) => sum + v, 0) > N * N / 2, 'the open ground around the spawn is connected');

    const buildings = new Set(world.buildings.filter((id) => id !== 0));
    assert.ok(buildings.size > 0, 'houses were generated');
    const entered = new Set();
    for (let k = 0; k < N; k++) {
      for (let i = 0; i < N; i++) {
        if (reached[i + k * N]) entered.add(world.buildingAt(Math.floor(point(i)), Math.floor(point(k))));
      }
    }
    for (const id of buildings) assert.ok(entered.has(id), `building ${id} can be entered from the spawn`);
  });

  test(`seed ${seed}: stairs are docked to the wall and can be climbed`, () => {
    const { world } = generateWorld(seed);
    for (const stairs of staircases(world)) {
      const { x, z, dir, wall, cells } = stairs;

      for (const cell of cells) {
        // Docked to a wall that stays whole behind them: no door, no window.
        for (let y = 1; y <= STOREY_H; y++) {
          assert.ok((world.getWalls(cell.x, y, cell.z) & wall.bit) !== 0, `the wall behind the stairs (${x}, ${z}) is whole at y=${y}`);
        }
        // The hole in the upper floor is exactly as wide as the stairs, the floor is next to it.
        assert.equal(world.getTop(cell.x, STOREY_H, cell.z), Top.None, 'hole above the stairs');
        assert.equal(world.getTop(cell.x - wall.dx, STOREY_H, cell.z - wall.dz), Top.Planks, 'floor next to the stairs');
      }
      const last = cells[STOREY_H - 1];
      assert.equal(world.getTop(last.x + dir.x, STOREY_H, last.z + dir.z), Top.Planks, 'the upper floor goes on past the last step');

      // Straight up from anywhere across the stairs (they pull the body to their middle), and pressing
      // diagonally into the wall or away from it all the way. Speed into the wall is s, away from it is -s.
      for (const [offset, s] of [[0.55, 0], [0.65, 0], [0.8, 0], [0.95, 0], [0.55, 3], [0.55, -1]]) {
        const start = atFootOfStairs(stairs, offset);
        const body = new PlayerBody(world, start.x, start.z);
        assert.equal(body.y, 1, 'starts on the ground floor');
        walk(body, dir.x * 3 + wall.dx * s, dir.z * 3 + wall.dz * s, 3.5);
        assert.equal(body.y, 1 + STOREY_H, `reached the upper floor at stairs (${x}, ${z}), offset=${offset}, s=${s}`);
      }
    }
  });
}

test('stairs come on every wall, rising either way, and the doors of two-storey houses on every side', () => {
  const stairsSeen = new Set();
  const doorSidesSeen = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const { world } = generateWorld(seed);
    for (const { dir, wall } of staircases(world)) stairsSeen.add(`${wall.bit}:${dir.x},${dir.z}`);

    const twoStorey = new Set(staircases(world).map(({ x, z }) => world.buildingAt(x, z)));
    for (let z = 0; z < world.sizeZ; z++) {
      for (let x = 0; x < world.sizeX; x++) {
        if (!twoStorey.has(world.buildingAt(x, z))) continue;
        // A door is a gap in the wall at the foot of the wall, under a lintel that stays.
        for (const side of WALL_SIDES) {
          if ((world.getWalls(x, STOREY_H, z) & side.bit) !== 0 && (world.getWalls(x, 1, z) & side.bit) === 0) doorSidesSeen.add(side.bit);
        }
      }
    }
  }
  assert.equal(stairsSeen.size, 8, `stairs seen on 4 walls in 2 directions, got ${[...stairsSeen]}`);
  assert.equal(doorSidesSeen.size, 4, `doors seen on all 4 sides, got ${[...doorSidesSeen]}`);
});

test('the player never overlaps anything and never freezes while wandering around the stairs', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { world } = generateWorld(seed);
    let rng = seed;
    const random = () => (rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296;

    for (const stairs of staircases(world)) {
      for (let run = 0; run < 3; run++) {
        const start = atFootOfStairs(stairs, 0.55);
        const body = new PlayerBody(world, start.x, start.z);
        let [vx, vz] = DIRECTIONS[0];
        for (let frame = 0; frame < 1500; frame++) {
          if (frame % 25 === 0) [vx, vz] = DIRECTIONS[Math.floor(random() * DIRECTIONS.length)];
          body.update(DT, vx * RUN_SPEED, vz * RUN_SPEED);
          assert.ok(body.fits(body.x, body.z, body.y), `seed ${seed}: no longer fits at (${body.x}, ${body.y}, ${body.z})`);
        }
        const free = DIRECTIONS.some(([dx, dz]) => body.canStand(body.x + dx * 0.05, body.z + dz * 0.05));
        assert.ok(free, `seed ${seed}: frozen at (${body.x}, ${body.y}, ${body.z})`);
      }
    }
  }
});
