import { WallSide } from '@game/world/blocks';
import { beaconProximity, doorHint, footprintDistance } from './door-hint';

describe('door hints', () => {
  it('a door needs a hint when the camera cannot see its wall: always in the north one, never in the south one', () => {
    const at = (side: number) => ({ x: 10, z: 10, side });
    const camera = { x: 10.5, z: 26 }; // the camera is far to the south, level with the door
    expect(doorHint(at(WallSide.North), camera.x, camera.z), 'north: never seen').toBe(1);
    expect(doorHint(at(WallSide.South), camera.x, camera.z), 'south: always seen').toBe(0);
    expect(doorHint(at(WallSide.West), camera.x, camera.z), 'west, seen edge-on').toBe(1);
    expect(doorHint(at(WallSide.West), 10.5 - 6, camera.z), 'west, from the west').toBe(0);
    expect(doorHint(at(WallSide.East), 10.5 - 6, camera.z), 'east, from the west: the other side').toBe(1);
    expect(doorHint(at(WallSide.East), 10.5 + 2, camera.z), 'east, half way to a good view').toBe(0.5);
  });

  it('the distance to a house is the distance to its nearest point, the same along a whole wall', () => {
    const house = { x0: 10, x1: 13, z0: 20, z1: 22 }; // the cells 10..14 by 20..23, so the footprint is [10, 14] x [20, 23]
    expect(footprintDistance(house, 12, 21), 'inside').toBe(0);
    expect(footprintDistance(house, 9, 21), 'beside the west wall').toBe(1);
    expect(footprintDistance(house, 9, 22.9), 'the same further along it').toBe(1);
    expect(footprintDistance(house, 12, 27), 'beside the south wall').toBe(4);
    expect(footprintDistance(house, 17, 27), 'off the corner: 3 and 4').toBe(5);
  });

  it('a beacon fades in between 4 and 3 blocks from the house, wherever its door is, and out again at the door', () => {
    const far = 10; // far from the door: only the house counts
    expect(beaconProximity(30, far), 'a house far away is of no interest').toBe(0);
    expect(beaconProximity(4, far), 'invisible at 4').toBe(0);
    expect(beaconProximity(3.5, far), 'half way').toBe(0.5);
    expect(beaconProximity(3, far), 'full at 3').toBe(1);
    expect(beaconProximity(0.3, far), 'at the wall, far from the door: still full').toBe(1);
    expect(beaconProximity(0.3, 1.5), 'dimmed on arrival at the door').toBe(0.5);
    expect(beaconProximity(0.3, 1), 'gone at the door').toBe(0);
  });
});
