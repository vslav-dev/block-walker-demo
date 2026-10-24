export const NeedId = {
  Hunger: 'hunger',
} as const;

export type NeedId = (typeof NeedId)[keyof typeof NeedId];

// A need is a level from 0 (nothing to ask for) to NEED_MAX (as bad as it gets). It grows with time and is brought down by
// things that relieve it (see items.ts). How loudly it speaks in the mind is its urgency, which the goals read.
export interface NeedDef {
  label: string;
  goal: string; // what the goal that relieves it is called
  action: string; // what a creature is doing while it relieves it
  rate: number; // how much the level grows in a second
  pressing: number; // the level where the urgency is 1: "this I must do something about now"
  sated: number; // the level where a creature stops relieving it
}

export const NEED_MAX = 1;
const URGENCY_POWER = 3; // small while the level is low, steep towards `pressing` and past it

export const NEEDS: Record<NeedId, NeedDef> = {
  [NeedId.Hunger]: { label: 'Hunger', goal: 'Eat', action: 'Eating', rate: 1 / 150, pressing: 0.7, sated: 0.15 },
};

export const urgencyOf = (need: NeedId, level: number): number => (level / NEEDS[need].pressing) ** URGENCY_POWER;

// The needs a creature has, and how high they are. A kind lists the needs its creatures have (a stone has none).
export class Needs {
  private readonly levels = new Map<NeedId, number>();

  // `initial` says how high each need starts, so that creatures made together do not all get hungry at once.
  constructor(ids: readonly NeedId[], initial: (id: NeedId) => number) {
    for (const id of ids) this.levels.set(id, initial(id));
  }

  entries(): IterableIterator<[NeedId, number]> {
    return this.levels.entries();
  }

  level(id: NeedId): number {
    return this.levels.get(id) ?? 0;
  }

  urgency(id: NeedId): number {
    return urgencyOf(id, this.level(id));
  }

  tick(dt: number): void {
    for (const [id, level] of this.levels) this.levels.set(id, Math.min(NEED_MAX, level + NEEDS[id].rate * dt));
  }

  relieve(id: NeedId, amount: number): void {
    this.levels.set(id, Math.max(0, this.level(id) - amount));
  }
}
