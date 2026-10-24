import { Tunables } from '@game/core/tunables';
import { LIGHT_LOOKS } from '@game/lighting/light-looks';
import { BIOME_RULES, Biome } from '@game/world/biome';
import { GAME_TUNABLES, type GameTuning } from './tuning';

describe('GAME_TUNABLES', () => {
  it('no two numbers share a key (the registry refuses it)', () => {
    expect(() => new Tunables<GameTuning>(GAME_TUNABLES, null)).not.toThrow();
  });

  it('every light says its brightness and its reach with numbers of the panel', () => {
    const keys = new Set(GAME_TUNABLES.map((spec) => spec.key));
    for (const [kind, look] of Object.entries(LIGHT_LOOKS)) {
      expect(keys.has(look.intensity), `${kind}: ${look.intensity}`).toBe(true);
      expect(keys.has(look.reach), `${kind}: ${look.reach}`).toBe(true);
    }
  });

  it('the numbers of the sky are shown where there is a sky, those of the lights where there is none, and the rest everywhere', () => {
    const shownIn = (group: string) => new Set(GAME_TUNABLES.filter((spec) => spec.group === group).map((spec) => spec.shownIn));
    expect(shownIn('Day and night')).toEqual(new Set([Biome.Surface]));
    expect(shownIn('Light')).toEqual(new Set([Biome.Interior]));
    expect(shownIn('Camera')).toEqual(new Set([undefined]));
    expect(shownIn('Simulation')).toEqual(new Set([undefined]));
    expect(BIOME_RULES[Biome.Surface].sky && !BIOME_RULES[Biome.Interior].sky, 'the panel follows the biomes').toBe(true);
  });
});
