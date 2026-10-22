// The kinds of places a world can be. A generator says which one its world is; the game takes the light from it.
export const Biome = {
  Surface: 'surface', // under the sky: the sun and the moon by turns, the days and the nights
  Interior: 'interior', // no sky at all: it is dark where nothing shines
} as const;

export type Biome = (typeof Biome)[keyof typeof Biome];

export interface BiomeRules {
  sky: boolean; // the light of the sky and the cycle of the days
  carriesLight: boolean; // the character holds a candle
  bodyShadow: boolean; // the character's body throws a shadow; it does not where it holds the light, or it would hide a half of the room from its own candle
  limitedSight: boolean; // only what the character's eyes see is shown, not what the camera over the roof sees: nothing is known of what is behind a wall
  // The walls between the camera and the character go: they fade to `opacity` (per second `speed`, the share of the way left that
  // is covered). Where the sight is limited they vanish, a faint wall would show the light of the room behind it, and they go
  // fast: the face of such a wall to the camera is a face the character does not see, and one that fades is a dark band over the room.
  wallFade: { opacity: number; speed: number };
}

export const BIOME_RULES: Record<Biome, BiomeRules> = {
  [Biome.Surface]: { sky: true, carriesLight: false, bodyShadow: true, limitedSight: false, wallFade: { opacity: 0.2, speed: 10 } },
  [Biome.Interior]: { sky: false, carriesLight: true, bodyShadow: false, limitedSight: true, wallFade: { opacity: 0, speed: 60 } },
};
