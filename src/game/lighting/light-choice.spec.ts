import { nearestLights } from './light-choice';

const light = (x: number, z: number, reach = 10) => ({ x, z, reach });
const reachOf = (l: { reach: number }) => l.reach;

describe('nearestLights', () => {
  it('takes the nearest ones, the nearest first', () => {
    const lights = [light(30, 0), light(5, 0), light(12, 0), light(2, 0)];
    expect(nearestLights(lights, 0, 0, 2, reachOf).map((l) => l.x)).toEqual([2, 5]);
  });

  it('all of them if there are fewer than asked for, and none for none', () => {
    const lights = [light(3, 0), light(1, 0)];
    expect(nearestLights(lights, 0, 0, 5, reachOf)).toHaveLength(2);
    expect(nearestLights([], 0, 0, 5, reachOf)).toEqual([]);
  });

  it('a far light that reaches the point comes before a near one that does not', () => {
    const lamp = light(20, 0, 30);
    const candle = light(8, 0, 4);
    expect(nearestLights([candle, lamp], 0, 0, 1, reachOf)).toEqual([lamp]);
  });

  it('measures on the ground: the height of a light does not matter, and the input is left as it is', () => {
    const lights = [light(0, 9), light(7, 0)];
    const copy = [...lights];
    expect(nearestLights(lights, 0, 0, 1, reachOf)).toEqual([light(7, 0)]);
    expect(lights).toEqual(copy);
  });
});
