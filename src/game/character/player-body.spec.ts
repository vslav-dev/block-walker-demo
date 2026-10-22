import { DT, SEEDS, atFootOfStairs, flatWorld, staircases, walk, wallWorld } from '@game/testing/worlds';
import { Block, STOREY_H, Top, WALL_THICKNESS } from '@game/world/blocks';
import { generateWorld } from '@game/world/generator';
import { PlayerBody, RADIUS, RUN_SPEED, WALL_REACH } from './player-body';

const SPEED = 3; // blocks per second
const LONG_TEST_MILLISECONDS = 60_000; // the wandering simulates 40 worlds, seconds of CPU
const GRID_STEP = 0.1;
// The directions the wandering body tries, a unit vector each, and standing still.
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [0, 0]].map(([x, z]) => [x, z].map((v) => v * Math.SQRT1_2 ** Math.abs(x * z)));

describe('PlayerBody', () => {
  it('a wall blocks the player, a door gap lets them through', () => {
    const world = wallWorld();

    const blocked = new PlayerBody(world, 1.5, 2.5);
    walk(blocked, SPEED, 0, 3);
    expect(blocked.x, `stopped at the wall, got x=${blocked.x}`).toBeLessThanOrEqual(4 - WALL_REACH + 1e-6);

    const through = new PlayerBody(world, 1.5, 6.5);
    walk(through, SPEED, 0, 2);
    expect(through.x, `passed the doorway, got x=${through.x}`).toBeGreaterThan(5);
  });

  it('a wall is only as thick as a slab: the rest of its cell is walkable', () => {
    const world = wallWorld();
    const body = new PlayerBody(world, 6.5, 2.5);
    walk(body, -SPEED, 0, 3);
    const face = 4 + WALL_THICKNESS + WALL_REACH;
    expect(body.x >= face - 1e-6 && body.x < face + 0.1, `stopped at the slab face, got x=${body.x}`).toBe(true);
  });

  it('a thin wall is not tunneled through, even in a long frame', () => {
    const world = wallWorld();
    for (const [from, vx] of [[1.5, RUN_SPEED], [6.5, -RUN_SPEED]]) {
      const body = new PlayerBody(world, from, 2.5);
      for (let t = 0; t < 2; t += 0.05) body.update(0.05, vx, 0);
      expect(Math.sign(body.x - 4), `stayed on its side, got x=${body.x}`).toBe(Math.sign(from - 4));
    }
  });

  it('a 1-block cube is an obstacle, not a step', () => {
    const world = flatWorld();
    world.set(2, 1, 2, Block.Planks); // 1-block ledge, too high to step on
    const body = new PlayerBody(world, 1.5, 2.5);
    walk(body, SPEED, 0, 1);
    expect(body.x, 'a 1-block cube is an obstacle').toBeLessThanOrEqual(2 - RADIUS + 1e-6);
    expect(body.y).toBe(1);
  });

  it('walking into the edge of an obstacle slides round it, walking into its middle stops', () => {
    const world = flatWorld();
    world.set(4, 1, 2, Block.Planks); // the cube covers x 4..5, z 2..3

    for (const [z, side] of [[2.0, -1], [2.1, -1], [3.0, 1], [2.9, 1]]) { // half on the cube, half beside it
      const body = new PlayerBody(world, 1.5, z);
      walk(body, SPEED, 0, 3);
      expect(body.x, `passed the cube, got x=${body.x} from z=${z}`).toBeGreaterThan(5.5);
      expect(Math.sign(body.z - z), `was pushed to the free side, got z=${body.z} from z=${z}`).toBe(side);
    }

    const middle = new PlayerBody(world, 1.5, 2.5);
    walk(middle, SPEED, 0, 3);
    expect(middle.x, 'still stops in front of the middle of the cube').toBeLessThanOrEqual(4 - RADIUS + 1e-6);
    expect(middle.z).toBe(2.5);

    // The same from the other three sides: [start x, start z, vx, vz].
    for (const [x, z, vx, vz] of [[6.5, 2.0, -3, 0], [4.0, 4.5, 0, -3], [4.0, 0.5, 0, 3], [4.9, 0.5, 0, 3]]) {
      const body = new PlayerBody(world, x, z);
      walk(body, vx, vz, 3);
      expect(Math.hypot(body.x - x, body.z - z), `passed the cube from (${x}, ${z}), got (${body.x}, ${body.z})`).toBeGreaterThan(3);
    }
  });

  it('a doorway is found when the body is a little off its middle', () => {
    const world = wallWorld(); // the doorway is z 6..7
    for (const z of [6.2, 6.8]) {
      const body = new PlayerBody(world, 1.5, z);
      walk(body, SPEED, 0, 3);
      expect(body.x, `passed the doorway from z=${z}, got x=${body.x}`).toBeGreaterThan(5);
    }
  });

  it('a floor is a plane to stand on, and a ceiling blocks the head only when it gets there', () => {
    const world = flatWorld();
    for (let z = 0; z < 8; z++) for (let x = 4; x < 8; x++) world.setTop(x, 2, z, Top.Planks); // a ceiling over x >= 4, plane y=3

    expect(world.groundAt(1.5, 1.5, 1), 'the ground is the plane at y=1').toBe(1);
    expect(world.groundAt(5.5, 1.5, 1), 'a ceiling is no ground').toBe(1);

    const under = new PlayerBody(world, 1.5, 2.5);
    walk(under, SPEED, 0, 3); // the head is 1.7 high, the slab starts at 2.9 above the ground plane at 1: it fits
    expect(under.x, `walked under the ceiling, got x=${under.x}`).toBeGreaterThan(6);

    const low = flatWorld();
    for (let z = 0; z < 8; z++) for (let x = 4; x < 8; x++) low.setTop(x, 1, z, Top.Planks); // plane y=2, the slab starts at 1.9
    const blocked = new PlayerBody(low, 1.5, 2.5);
    walk(blocked, SPEED, 0, 3);
    expect(blocked.x, `a low ceiling stops the head, got x=${blocked.x}`).toBeLessThanOrEqual(4 - RADIUS + 1e-6);
  });

  for (const seed of SEEDS) {
    it(`seed ${seed}: every building is enterable`, () => {
      const { world, spawn } = generateWorld(seed);
      expect(world.groundAt(spawn.x, spawn.z, 1), 'spawn is on the ground').toBe(1);

      // Flood fill the ground floor from the spawn on a grid much finer than the walls are thick.
      // Grid points sit at odd multiples of 0.05, so the player's edges never coincide with a wall face.
      const N = Math.round(world.sizeX / GRID_STEP);
      const point = (i: number) => (i + 0.5) * GRID_STEP;
      const probe = new PlayerBody(world, spawn.x, spawn.z);
      const reached = new Uint8Array(N * N);
      const queue = [[Math.floor(spawn.x / GRID_STEP), Math.floor(spawn.z / GRID_STEP)]];
      while (queue.length) {
        const [i, k] = queue.pop()!;
        if (i < 0 || k < 0 || i >= N || k >= N || reached[i + k * N] || !probe.canStand(point(i), point(k))) continue;
        reached[i + k * N] = 1;
        queue.push([i + 1, k], [i - 1, k], [i, k + 1], [i, k - 1]);
      }

      expect(reached.reduce((sum, v) => sum + v, 0), 'the open ground around the spawn is connected').toBeGreaterThan((N * N) / 2);

      const buildings = new Set(world.buildings.filter((id) => id !== 0));
      expect(buildings.size, 'houses were generated').toBeGreaterThan(0);
      const entered = new Set<number>();
      for (let k = 0; k < N; k++) {
        for (let i = 0; i < N; i++) {
          if (reached[i + k * N]) entered.add(world.buildingAt(Math.floor(point(i)), Math.floor(point(k))));
        }
      }
      for (const id of buildings) expect(entered.has(id), `building ${id} can be entered from the spawn`).toBe(true);
    });

    it(`seed ${seed}: stairs are docked to the wall and can be climbed`, () => {
      const { world } = generateWorld(seed);
      for (const stairs of staircases(world)) {
        const { x, z, dir, wall, cells } = stairs;

        for (const cell of cells) {
          // Docked to a wall that stays whole behind them: no door, no window.
          for (let y = 1; y <= STOREY_H; y++) {
            expect((world.getWalls(cell.x, y, cell.z) & wall.bit) !== 0, `the wall behind the stairs (${x}, ${z}) is whole at y=${y}`).toBe(true);
          }
          // The hole in the upper floor is exactly as wide as the stairs and reaches over the landing at their foot, the floor is next to it.
          expect(world.getTop(cell.x, STOREY_H, cell.z), 'hole above the stairs').toBe(Top.None);
          expect(world.getTop(cell.x - wall.dx, STOREY_H, cell.z - wall.dz), 'floor next to the stairs').toBe(Top.Planks);
        }
        const last = cells[STOREY_H];
        expect(world.getTop(last.x + dir.x, STOREY_H, last.z + dir.z), 'the upper floor goes on past the last step').toBe(Top.Planks);

        // Straight up from anywhere across the stairs (they pull the body to their middle), and pressing
        // diagonally into the wall or away from it all the way. Speed into the wall is s, away from it is -s.
        for (const [offset, s] of [[0.55, 0], [0.65, 0], [0.8, 0], [0.95, 0], [0.55, 3], [0.55, -1]]) {
          const start = atFootOfStairs(stairs, offset);
          const body = new PlayerBody(world, start.x, start.z);
          expect(body.y, 'starts on the ground floor').toBe(1);
          walk(body, dir.x * 3 + wall.dx * s, dir.z * 3 + wall.dz * s, 3.5);
          expect(body.y, `reached the upper floor at stairs (${x}, ${z}), offset=${offset}, s=${s}`).toBe(1 + STOREY_H);
        }
      }
    });
  }

  it('the player never overlaps anything and never freezes while wandering around the stairs', () => {
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
            expect(body.fits(body.x, body.z, body.y), `seed ${seed}: no longer fits at (${body.x}, ${body.y}, ${body.z})`).toBe(true);
          }
          const free = DIRECTIONS.some(([dx, dz]) => body.canStand(body.x + dx * 0.05, body.z + dz * 0.05));
          expect(free, `seed ${seed}: frozen at (${body.x}, ${body.y}, ${body.z})`).toBe(true);
        }
      }
    }
  }, LONG_TEST_MILLISECONDS);
});
