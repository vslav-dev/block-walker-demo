// What a creature can do, in numbers. The same stats are read by everything that depends on them (walking now, fighting and
// seeing later), for a robot of the player and for a bear alike. Every read goes through the creature's stats, so that a layer of
// modifiers (a wound, a skill) can later stand between the kind's numbers and the one who reads them.
export const StatId = {
  WalkSpeed: 'walkSpeed', // blocks per second
  SightRadius: 'sightRadius', // blocks: how far the creature notices what it looks for
} as const;

export type StatId = (typeof StatId)[keyof typeof StatId];

export type Stats = Readonly<Record<StatId, number>>;
