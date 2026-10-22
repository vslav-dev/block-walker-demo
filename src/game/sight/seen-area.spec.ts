import { polygonContains } from '@game/testing/geometry';
import { generateDepot } from '@game/world/depot/depot-generator';
import { sightSegments } from './sight-segments';
import { SeenArea } from './seen-area';
import { Occluders } from './visibility-polygon';

describe('SeenArea', () => {
  it('is what a polygon says: the point is in it, or it is not, as the polygon fanned from the point', () => {
    const occluders = new Occluders([
      { ax: 5, az: -10, bx: 5, bz: -0.5 },
      { ax: 5, az: 0.5, bx: 5, bz: 10 },
      { ax: -4, az: -10, bx: -4, bz: 10 },
    ]);
    const corners = occluders.polygonFrom(0, 0, 30);
    const area = new SeenArea(0, 0, corners);
    for (const [x, z] of [[0, 0], [3, 2], [-3, 8], [4.9, 0], [8, 0], [20, 1], [8, 3], [20, 6], [-4.1, 0], [-20, 3], [4.99, 9.9], [5.1, 0.2]]) {
      expect(area.contains(x, z), `(${x}, ${z})`).toBe(polygonContains(corners, x, z));
    }
  });

  it('agrees with the polygon at any point of a depot, seen from the start: in a room, in the cones of its doorways, and nowhere else', () => {
    for (const seed of [1, 7, 42]) {
      const { world, spawn } = generateDepot(seed);
      const corners = new Occluders(sightSegments(world, 2)).polygonFrom(spawn.x, spawn.z, 60);
      const area = new SeenArea(spawn.x, spawn.z, corners);
      for (let z = 0.13; z < world.sizeZ; z += 0.37) {
        for (let x = 0.07; x < world.sizeX; x += 0.41) expect(area.contains(x, z), `seed ${seed}: (${x.toFixed(2)}, ${z.toFixed(2)})`).toBe(polygonContains(corners, x, z));
      }
    }
  });
});
