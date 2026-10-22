import { SEEDS, staircases } from '@game/testing/worlds';
import { Biome } from '@game/world/biome';
import { Opening, STOREY_H, WALL_SIDES, frameOpening, frameSide } from '@game/world/blocks';
import { EYE_H } from '@game/world/world';
import { generateTown } from './town-generator';

describe('generateTown', () => {
  it('the town is under the sky and has no lights of its own', () => {
    const { world, biome } = generateTown(1);
    expect(biome).toBe(Biome.Surface);
    expect(world.lights).toEqual([]);
  });

  it('every building has exactly one entrance, a gap in its wall as high as the wall', () => {
    for (const seed of SEEDS) {
      const { world } = generateTown(seed);
      const buildings = new Set(world.buildings.filter((id) => id !== 0));
      expect(world.doors.length, `seed ${seed}: one door per building`).toBe(buildings.size);
      for (const door of world.doors) {
        expect(world.buildingAt(door.x, door.z), 'the door is in its building').toBe(door.building);
        for (let y = 1; y <= STOREY_H; y++) expect(world.getWalls(door.x, y, door.z) & door.side, `gap at y=${y}`).toBe(0);
      }
    }
  });

  it('buildings have plenty of windows: a gap at eye level over a parapet that stays', () => {
    for (const seed of SEEDS) {
      const { world } = generateTown(seed);
      const windows = new Map<number, number>(); // building id -> number of windows on the ground floor
      for (let z = 0; z < world.sizeZ; z++) {
        for (let x = 0; x < world.sizeX; x++) {
          for (const side of WALL_SIDES) {
            const has = (y: number) => (world.getWalls(x, y, z) & side.bit) !== 0;
            if (has(1) && !has(2)) windows.set(world.buildingAt(x, z), (windows.get(world.buildingAt(x, z)) ?? 0) + 1);
          }
        }
      }
      const buildings = new Set(world.buildings.filter((id) => id !== 0));
      for (const id of buildings) expect(windows.get(id) ?? 0, `seed ${seed}: building ${id} has windows`).toBeGreaterThanOrEqual(3);
    }
  });

  it('doors and windows are framed, one frame in the lowest row of the storey, in the wall they are in', () => {
    for (const seed of SEEDS) {
      const { world } = generateTown(seed);
      for (const door of world.doors) {
        const frame = world.getFrame(door.x, 1, door.z);
        expect(frameSide(frame), 'the frame is in the wall of the door').toBe(door.side);
        expect(frameOpening(frame)).toBe(Opening.Door);
        expect(world.getFrame(door.x, 2, door.z), 'nothing in the upper row: the frame is whole').toBe(0);
      }

      for (let z = 0; z < world.sizeZ; z++) {
        for (let x = 0; x < world.sizeX; x++) {
          for (const side of WALL_SIDES) {
            const has = (y: number) => (world.getWalls(x, y, z) & side.bit) !== 0;
            if (!(has(1) && !has(2))) continue; // a window
            const frame = world.getFrame(x, 1, z);
            expect(frameSide(frame) === side.bit && frameOpening(frame) === Opening.Window, `window (${x}, ${z}) has its frame`).toBe(true);
          }
        }
      }
    }
  });

  it('the eyes see out of every window and door of every house, a knee-high ray does not pass the parapet', () => {
    for (const seed of SEEDS) {
      const { world } = generateTown(seed);
      for (let z = 0; z < world.sizeZ; z++) {
        for (let x = 0; x < world.sizeX; x++) {
          for (const side of WALL_SIDES) {
            const has = (y: number) => (world.getWalls(x, y, z) & side.bit) !== 0;
            const door = world.doors.some((d) => d.x === x && d.z === z && d.side === side.bit);
            const window = has(1) && !has(2);
            if (!door && !window) continue;
            const out = (height: number) => world.castRay(x + 0.5, 1 + height, z + 0.5, side.dx, side.dz, 1.4); // a bit past the wall: a rock may stand beyond
            expect(out(EYE_H), `seed ${seed}: the eyes see out of (${x}, ${z})`).toBeGreaterThanOrEqual(1.4 - 0.06);
            if (window) expect(out(0.3), `seed ${seed}: under the window (${x}, ${z}) the wall stops the ray`).toBeLessThan(1);
          }
        }
      }
    }
  });

  it('the tested seeds contain staircases', () => {
    expect(SEEDS.some((seed) => staircases(generateTown(seed).world).length > 0)).toBe(true);
  });

  it('stairs come on every wall, rising either way, and the doors of two-storey houses on every side', () => {
    const stairsSeen = new Set<string>();
    const doorSidesSeen = new Set<number>();
    for (let seed = 1; seed <= 100; seed++) {
      const { world } = generateTown(seed);
      for (const { dir, wall } of staircases(world)) stairsSeen.add(`${wall.bit}:${dir.x},${dir.z}`);

      const twoStorey = new Set(staircases(world).map(({ x, z }) => world.buildingAt(x, z)));
      for (let z = 0; z < world.sizeZ; z++) {
        for (let x = 0; x < world.sizeX; x++) {
          if (!twoStorey.has(world.buildingAt(x, z))) continue;
          // A door is a gap in the wall of the ground floor, under the wall of the upper one.
          for (const side of WALL_SIDES) {
            if ((world.getWalls(x, STOREY_H + 1, z) & side.bit) !== 0 && (world.getWalls(x, 1, z) & side.bit) === 0) doorSidesSeen.add(side.bit);
          }
        }
      }
    }
    expect(stairsSeen.size, `stairs seen on 4 walls in 2 directions, got ${[...stairsSeen]}`).toBe(8);
    expect(doorSidesSeen.size, `doors seen on all 4 sides, got ${[...doorSidesSeen]}`).toBe(4);
  });
});
