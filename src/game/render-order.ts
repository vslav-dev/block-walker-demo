// The order in which what is translucent or drawn over the picture is drawn, the first first (three.js sorts by it, and draws
// what is opaque before all of that). The numbers are in one place, since the order is the point: the picture is built up by it.
export const RenderOrder = {
  AimLine: -1, // in the world, before everything translucent: a fading wall is drawn over it and does not hide it with its depth
  SightVolume: 6, // what the character sees is counted in the stencil buffer...
  SightShroud: 7, // ...and what is not seen is blacked out
  FadedWall: 8, // after that: a wall that fades does not count in what is seen, and is drawn only over what is seen
  Beacon: 10, // over the walls: it shows through them
  AimLineOverEverything: 11, // after the beacons
  CreatureLabel: 12, // the last: what a creature does is written over everything, it shows through walls
} as const;
