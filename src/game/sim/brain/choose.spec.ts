import { createRandom } from '@game/world/random';
import { pickWeighted } from './choose';

const TEMPERATURE = 0.08;

// How often each index is picked in `samples` picks.
function frequencies(scores: number[], samples: number): number[] {
  const { rand } = createRandom(7);
  const counts = scores.map(() => 0);
  for (let i = 0; i < samples; i++) counts[pickWeighted(scores, TEMPERATURE, rand)]++;
  return counts.map((count) => count / samples);
}

describe('pickWeighted', () => {
  it('a score far above the rest leaves them next to no chance', () => {
    expect(frequencies([2, 0.3, 0.25], 2000)[0]).toBe(1);
  });

  it('equal scores are picked about equally often', () => {
    const [a, b] = frequencies([0.3, 0.3], 4000);
    expect(a).toBeGreaterThan(0.45);
    expect(b).toBeGreaterThan(0.45);
  });

  it('a higher score is picked more often, a lower one still sometimes', () => {
    const [a, b] = frequencies([0.3, 0.2], 4000); // weights 1 : exp(-0.1 / 0.08) = 0.29
    expect(a / b).toBeGreaterThan(2.5);
    expect(a / b).toBeLessThan(4.5);
    expect(b).toBeGreaterThan(0.1);
  });

  it('only the differences count, not the size of the scores', () => {
    const small = frequencies([0.3, 0.2], 1000);
    const large = frequencies([30.3, 30.2], 1000);
    expect(large[0]).toBeCloseTo(small[0], 1);
  });

  it('the ends of the chance pick the ends of the list', () => {
    expect(pickWeighted([1, 1, 1], TEMPERATURE, () => 0)).toBe(0);
    expect(pickWeighted([1, 1, 1], TEMPERATURE, () => 0.999999)).toBe(2);
  });
});
