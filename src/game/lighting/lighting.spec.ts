import { Tunables } from '@game/core/tunables';
import { wallWorld } from '@game/testing/worlds';
import { GAME_TUNABLES, type GameTuning } from '@game/tuning';
import { LightKind } from '@game/world/light';
import { World } from '@game/world/world';
import * as THREE from 'three';
import { Darkness } from './atmosphere';
import { HAND, LIGHT_LOOKS } from './light-looks';
import { Lighting } from './lighting';

const DT = 1 / 60;
const FLOOR_Y = 1;

const GAP = 6;
const WALK_SPEED = 8; // blocks per second: faster than the character runs

// A long hall with a candle every GAP blocks along x, the first at x = 3.
function hall(count: number): World {
  const world = new World(count * GAP + 6, 4, 10);
  for (let i = 0; i < count; i++) world.lights.push({ kind: LightKind.Candle, x: 3 + i * GAP, y: FLOOR_Y + 1.1, z: 5 });
  return world;
}

const tuning = (): GameTuning => new Tunables<GameTuning>(GAME_TUNABLES, null).values;
const pointLights = (scene: THREE.Scene): THREE.PointLight[] => {
  const found: THREE.PointLight[] = [];
  scene.traverse((o) => {
    if (o instanceof THREE.PointLight) found.push(o);
  });
  return found;
};

// Plays `seconds` of the game with the character standing at x.
function stand(lighting: Lighting, x: number, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) lighting.update(DT, x, FLOOR_Y, 5, 0);
}

describe('Lighting', () => {
  it('a world without lights has none in the scene, however the character carries one or not', () => {
    const scene = new THREE.Scene();
    new Lighting(hall(0), scene, tuning(), false);
    expect(pointLights(scene)).toHaveLength(0);
  });

  it('the light in the hand is one more light, and it shines at once', () => {
    const scene = new THREE.Scene();
    const lighting = new Lighting(hall(0), scene, tuning(), true);
    stand(lighting, 5, DT);
    const [hand, ...others] = pointLights(scene);
    expect(others).toEqual([]);
    expect(hand.intensity).toBeGreaterThan(0);
    expect(hand.distance).toBe(tuning()[LIGHT_LOOKS[HAND].reach]);
  });

  it('the light in the hand has no shadow, which would be drawn every frame; those of the world have one, drawn once', () => {
    const scene = new THREE.Scene();
    new Lighting(hall(3), scene, tuning(), true);
    const lights = pointLights(scene);
    const [world, hand] = [lights.filter((l) => l.castShadow), lights.filter((l) => !l.castShadow)];
    expect(hand).toHaveLength(1);
    expect(world.length).toBeGreaterThan(0);
    expect(world.every((l) => !l.shadow.autoUpdate)).toBe(true);
  });

  it('the number of lights in the scene is fixed, however many the world has and wherever the character goes', () => {
    const scene = new THREE.Scene();
    const lighting = new Lighting(hall(20), scene, tuning(), true);
    const count = pointLights(scene).length;
    expect(count, 'a few of the lights of the world and the one in the hand').toBeLessThan(20);
    for (const x of [3, 40, 90, 3]) {
      stand(lighting, x, 1);
      expect(pointLights(scene)).toHaveLength(count);
    }
  });

  it('only the nearest lights of the world shine, and when the character walks on, the others take over', () => {
    const scene = new THREE.Scene();
    const world = hall(20);
    const lighting = new Lighting(world, scene, tuning(), false);
    const shiningAt = (): number[] =>
      pointLights(scene)
        .filter((light) => light.intensity > 0)
        .map((light) => light.position.x)
        .sort((a, b) => a - b);

    stand(lighting, 4, 2);
    expect(shiningAt(), 'the first four, by the character').toEqual([3, 9, 15, 21]);
    stand(lighting, 94, 2);
    expect(shiningAt(), 'the four by the character now').toEqual([87, 93, 99, 105]);
  });

  it('a light fades in and out while the character walks past, it does not jump', () => {
    const scene = new THREE.Scene();
    const lighting = new Lighting(hall(20), scene, tuning(), false);
    stand(lighting, 4, 2);
    const brightest = Math.max(...pointLights(scene).map((light) => light.intensity));
    let last = pointLights(scene).map((light) => light.intensity);
    for (let x = 4; x < 94; x += WALK_SPEED * DT) {
      lighting.update(DT, x, FLOOR_Y, 5, 0);
      const now = pointLights(scene).map((light) => light.intensity);
      now.forEach((intensity, i) => expect(Math.abs(intensity - last[i]), `light ${i} at x = ${x.toFixed(1)}`).toBeLessThan(brightest * 0.1));
      last = now;
    }
  });

  it('the readout says how many of the lights shine', () => {
    const lighting = new Lighting(hall(3), new THREE.Scene(), tuning(), true);
    stand(lighting, 3, 2);
    expect(lighting.readouts.map((readout) => readout.read())).toEqual(['4 / 4']);
    expect(new Lighting(hall(0), new THREE.Scene(), tuning(), false).readouts, 'nothing to say where nothing shines').toEqual([]);
  });

  it('the hand does not reach through a wall in front of the character', () => {
    const world = new World(12, 4, 10);
    // A wall on the west border of the column 6, at the height of the hand.
    for (let row = 1; row <= 3; row++) world.addWalls(6, row, 5, 4);
    const scene = new THREE.Scene();
    const lighting = new Lighting(world, scene, tuning(), true);
    lighting.update(DT, 5.7, FLOOR_Y, 5.5, Math.PI / 2); // yaw a quarter turn: towards +x, at the wall
    const [hand] = pointLights(scene);
    expect(hand.position.x, 'on this side of the wall').toBeLessThan(6);
  });
});

describe('the candle in the hand and a doorway', () => {
  // The wall is across x at x = 4, the doorway is z 6..7. The character faces east, to +x.
  const EAST = Math.PI / 2;
  const setup = () => {
    const scene = new THREE.Scene();
    const lighting = new Lighting(wallWorld(), scene, tuning(), true);
    const stay = (x: number, z: number, seconds: number): void => {
      for (let t = 0; t < seconds; t += DT) lighting.update(DT, x, FLOOR_Y, z, EAST);
    };
    return { stay, candle: (): number => pointLights(scene)[0].position.x };
  };

  it('is not past the doorway while the character is not: a light in the next room would leave the shadow of the wall on this one', () => {
    for (const [x, z] of [[2.5, 6.5], [3.2, 6.5], [3.6, 6.5], [3.8, 6.5], [3.4, 5.5]]) {
      const { stay, candle } = setup();
      stay(x, z, 1);
      expect(candle(), `the character at (${x}, ${z}), the candle on his side of the wall`).toBeLessThan(4);
    }
  });

  it('goes out to its place in front of him once he is through, not in a jump, and is taken in at once where a wall is', () => {
    const { stay, candle } = setup();
    stay(3.6, 6.5, 1);
    expect(candle()).toBeLessThan(4);
    stay(4.3, 6.5, DT); // through the wall
    expect(candle(), 'one frame after, not yet all the way to its place').toBeLessThan(4.3 + 0.7 - 0.1);
    stay(4.3, 6.5, 0.5);
    expect(candle(), 'half a second after, it is in front of him').toBeCloseTo(4.3 + 0.7, 1);
    stay(3.9, 6.5, DT); // back to the wall
    expect(candle(), 'drawn in at once, not past the wall').toBeLessThan(4);
  });
});

describe('Darkness', () => {
  it('is black and has no light but the one asked for', () => {
    const scene = new THREE.Scene();
    const values = { ambient: 0 };
    const darkness = new Darkness(scene, values);
    darkness.update();
    expect((scene.background as THREE.Color).getHex()).toBe(0);
    const lights: THREE.Light[] = [];
    scene.traverse((o) => o instanceof THREE.Light && lights.push(o));
    expect(lights.map((light) => light.intensity)).toEqual([0]);
    values.ambient = 0.5;
    darkness.update();
    expect(lights[0].intensity).toBe(0.5);
  });
});
