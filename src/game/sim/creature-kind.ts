import type { Goal } from '@game/sim/brain/goal';
import { needGoal } from '@game/sim/brain/goals/need-goal';
import { restGoal } from '@game/sim/brain/goals/rest';
import { wanderGoal } from '@game/sim/brain/goals/wander';
import { NeedId } from '@game/sim/needs';
import { StatId, type Stats } from '@game/sim/stats';

export const CreatureKindId = {
  Human: 'human',
} as const;

export type CreatureKindId = (typeof CreatureKindId)[keyof typeof CreatureKindId];

// What a kind of creature is, as a table row: its stats, the needs its creatures have and the goals they pursue. A creature
// without goals has no mind of its own (it is controlled from outside: the player will be one). An animal is a new row.
export interface CreatureKind {
  label: string;
  stats: Stats;
  needs: readonly NeedId[];
  goals: readonly Goal[];
}

export const CREATURE_KINDS: Record<CreatureKindId, CreatureKind> = {
  [CreatureKindId.Human]: {
    label: 'Human',
    stats: { [StatId.WalkSpeed]: 3, [StatId.SightRadius]: 9 },
    needs: [NeedId.Hunger],
    goals: [needGoal(NeedId.Hunger), wanderGoal, restGoal],
  },
};
