// A random integer from min to max, both included.
export type RandomInt = (min: number, max: number) => number;

export interface Random {
  rand: () => number; // 0 up to 1, 1 not included
  int: RandomInt;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The same seed gives the same numbers in the same order: the same world.
export function createRandom(seed: number): Random {
  const rand = mulberry32(seed);
  return { rand, int: (min, max) => min + Math.floor(rand() * (max - min + 1)) };
}
