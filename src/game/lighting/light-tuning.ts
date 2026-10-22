import type { TunableSpec } from '@game/core/tunables';
import { Biome } from '@game/world/biome';

// The light that stands in a world and that the character carries, for the debug panel: how bright it is and how far it reaches.
// Brightness is the intensity of a point light (candela), reach the distance where its light dies out; the light falls off
// with the square of the distance before that, so a dim and far light shows a whole room, but weakly.
export interface LightTuning {
  candleIntensity: number;
  candleReach: number;
  lampIntensity: number;
  lampReach: number;
  handIntensity: number;
  handReach: number;
  ambient: number;
}

export const LIGHT_GROUP = 'Light';
const LIGHT = { group: LIGHT_GROUP, shownIn: Biome.Interior }; // the light of the sky has its own numbers

export const LIGHT_TUNABLES: readonly TunableSpec[] = [
  { key: 'candleIntensity', ...LIGHT, label: 'Candle brightness', min: 0, max: 60, step: 0.5, value: 9 },
  { key: 'candleReach', ...LIGHT, label: 'Candle reach (blocks)', min: 2, max: 40, step: 1, value: 16 },
  { key: 'lampIntensity', ...LIGHT, label: 'Lamp brightness', min: 0, max: 200, step: 1, value: 45 },
  { key: 'lampReach', ...LIGHT, label: 'Lamp reach (blocks)', min: 2, max: 60, step: 1, value: 26 },
  { key: 'handIntensity', ...LIGHT, label: 'Candle in the hand: brightness', min: 0, max: 60, step: 0.5, value: 14 },
  { key: 'handReach', ...LIGHT, label: 'Candle in the hand: reach (blocks)', min: 2, max: 40, step: 1, value: 12 },
  { key: 'ambient', ...LIGHT, label: 'Light from nowhere (debug)', min: 0, max: 2, step: 0.01, value: 0 },
];
