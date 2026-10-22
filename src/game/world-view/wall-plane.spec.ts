import { SEEDS } from '@game/testing/worlds';
import { WALL_SIDES, WallSide, wallSideByBit } from '@game/world/blocks';
import { generateDepot } from '@game/world/depot/depot-generator';
import { collectLayerGroups } from './layer-groups';
import { separates, wallPlaneOf } from './wall-plane';

describe('wall planes', () => {
  it('the walls on the two sides of one border are in one plane, the others are not', () => {
    const southOfRow = wallPlaneOf(wallSideByBit(WallSide.South), 5, 9);
    const northOfNext = wallPlaneOf(wallSideByBit(WallSide.North), 5, 10);
    expect(southOfRow).toEqual({ axis: 'z', at: 10 });
    expect(northOfNext).toEqual(southOfRow);
    const eastOfColumn = wallPlaneOf(wallSideByBit(WallSide.East), 4, 9);
    expect(eastOfColumn).toEqual({ axis: 'x', at: 5 });
    expect(wallPlaneOf(wallSideByBit(WallSide.West), 5, 9)).toEqual(eastOfColumn);
    expect(wallPlaneOf(wallSideByBit(WallSide.West), 5, 10), 'the same column, another row: the same plane').toEqual(eastOfColumn);
  });

  it('a plane is in the way when the player and the camera are on its two sides, whichever side the player is on', () => {
    const plane = { axis: 'z', at: 10 } as const;
    expect(separates(plane, 3, 8, 3, 20), 'the player north of it, the camera south').toBe(true);
    expect(separates(plane, 3, 12, 3, 20), 'the player south of it too: behind him, not in the way').toBe(false);
    expect(separates(plane, 3, 12, 3, 5), 'the camera north of it, the player south').toBe(true);
    expect(separates(plane, 3, 8, 90, 7), 'both north of it').toBe(false);
    expect(separates({ axis: 'x', at: 4 }, 3, 8, 3.5, 40), 'the camera due south, the plane beside the player').toBe(false);
    expect(separates({ axis: 'x', at: 4 }, 3, 8, 9, 40), 'the camera far to the east').toBe(true);
  });

  it('a plane is in the way as soon as the edge of the player that is farther from the camera is across it', () => {
    const plane = { axis: 'z', at: 10 } as const;
    // The player stands south of the plane at z = 10.3, the camera is farther south; he is 0.4 wide on each side.
    expect(separates(plane, 3, 10.3, 3, 30), 'by his middle he is not across').toBe(false);
    expect(separates(plane, 3, 10.3, 3, 30, 0.4), 'by his edge he is').toBe(true);
    expect(separates(plane, 3, 10.5, 3, 30, 0.4), 'his edge is not yet across').toBe(false);
    expect(separates(plane, 3, 9.7, 3, 30, 0.4), 'across by his middle: all the more').toBe(true);
    expect(separates(plane, 3, 9.5, 3, -20, 0.4), 'the camera is north too, and the plane is behind him: his edge is not across').toBe(false);
    expect(separates(plane, 3, 10.2, 3, 10.2, 0.4), 'the camera right over him, no side that is farther: his middle decides').toBe(false);
  });

  it('the walls of a layer are all in its plane, whichever side of their cells they are on', () => {
    for (const seed of SEEDS) {
      const { world } = generateDepot(seed);
      for (const { plane, cells, type } of collectLayerGroups(world)) {
        if (plane === null) continue;
        for (const cell of cells) {
          const side = WALL_SIDES.find((s) => s.rotY === cell.rotY)!;
          expect(wallPlaneOf(side, cell.x, cell.z), `seed ${seed}: ${type}`).toEqual(plane);
        }
      }
    }
  });

  it('a partition is one plane for both rooms: the layer is the same whatever side of the cells it was built on', () => {
    for (const seed of SEEDS) {
      const { world } = generateDepot(seed);
      const planes = new Set(collectLayerGroups(world).flatMap((group) => (group.plane ? [`${group.plane.axis}${group.plane.at}`] : [])));
      // Four outer planes at least, and every partition adds one; two walls of the same plane add none.
      expect(planes.size, `seed ${seed}`).toBeGreaterThan(4);
      expect(planes.has('x0') && planes.has(`x${world.sizeX}`) && planes.has('z0') && planes.has(`z${world.sizeZ}`), 'the outer walls').toBe(true);
    }
  });
});
