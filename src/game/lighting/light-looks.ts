import { LightKind } from '@game/world/light';
import type { LightTuning } from './light-tuning';

// The light the character carries is a light of its own beside those that stand in the world.
export const HAND = 'hand';
export type SourceKind = LightKind | typeof HAND;

export interface LightLook {
  color: number;
  flicker: number; // by how much of its brightness a light swings, 0 = steady
  intensity: keyof LightTuning; // which numbers of the panel say how bright it is and how far it reaches
  reach: keyof LightTuning;
}

export const LIGHT_LOOKS: Record<SourceKind, LightLook> = {
  [LightKind.Candle]: { color: 0xffa95c, flicker: 0.1, intensity: 'candleIntensity', reach: 'candleReach' },
  [LightKind.Lamp]: { color: 0xfff1dc, flicker: 0, intensity: 'lampIntensity', reach: 'lampReach' },
  [HAND]: { color: 0xffa95c, flicker: 0.1, intensity: 'handIntensity', reach: 'handReach' },
};

// How much of its brightness a light has at a moment: a flame never burns quite evenly. `phase` sets two lights of a kind apart.
export function flicker(look: LightLook, time: number, phase: number): number {
  return 1 + look.flicker * (0.6 * Math.sin(time * 11 + phase * 3.7) + 0.4 * Math.sin(time * 5.3 + phase * 1.3));
}
