// The sources of light that stand in a world. What they look like and how bright they are is the business of the view (see
// lighting), the world only says what and where.
export const LightKind = {
  Candle: 'candle', // dim, warm: shows a whole room, but weakly
  Lamp: 'lamp', // a chandelier or a bulb under the ceiling: bright and white
} as const;

export type LightKind = (typeof LightKind)[keyof typeof LightKind];

// A source at a point of the world (the flame, the bulb), in world coordinates like the player's.
export interface WorldLight {
  kind: LightKind;
  x: number;
  y: number;
  z: number;
}

// How high a flame or a bulb stands above the floor of its storey. A candle is on a stand, a lamp hangs from the ceiling.
export const LIGHT_HEIGHT: Record<LightKind, number> = {
  [LightKind.Candle]: 1.1,
  [LightKind.Lamp]: 1.75,
};
