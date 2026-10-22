import { SceneId, generateWorld, randomSeed } from './generator';

// The same world twice: every layer of the data equal.
function sameWorld(a: ReturnType<typeof generateWorld>, b: ReturnType<typeof generateWorld>): boolean {
  const layers = ['blocks', 'walls', 'tops', 'frames', 'buildings'] as const;
  return layers.every((layer) => a.world[layer].every((value, i) => value === b.world[layer][i])) && a.spawn.x === b.spawn.x && a.spawn.z === b.spawn.z;
}

describe('generateWorld', () => {
  for (const scene of Object.values(SceneId)) {
    it(`${scene}: the same seed is the same world, another seed is another`, () => {
      expect(sameWorld(generateWorld(scene, 7), generateWorld(scene, 7))).toBe(true);
      expect(sameWorld(generateWorld(scene, 7), generateWorld(scene, 8))).toBe(false);
    });

    it(`${scene}: the player starts on the ground`, () => {
      for (const seed of [1, 2, 3, 42, 777]) {
        const { world, spawn } = generateWorld(scene, seed);
        expect(world.groundAt(spawn.x, spawn.z, 1), `seed ${seed}`).toBe(1);
      }
    });
  }

  it('a seed is a whole number below a million', () => {
    for (let i = 0; i < 100; i++) {
      const seed = randomSeed();
      expect(Number.isInteger(seed) && seed >= 0 && seed < 1e6).toBe(true);
    }
  });
});
