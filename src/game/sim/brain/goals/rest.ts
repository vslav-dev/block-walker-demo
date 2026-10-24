import { Wait } from '@game/sim/brain/actions/wait';
import type { Goal } from '@game/sim/brain/goal';

export const REST_SCORE = 0.25; // a little less than wandering
const SECONDS = { min: 4, max: 10 };

// Stands about for a while.
export const restGoal: Goal = {
  id: 'rest',
  label: 'Rest',
  score: () => REST_SCORE,
  plan: (_self, sim) => [new Wait('Resting', SECONDS.min + sim.random.rand() * (SECONDS.max - SECONDS.min))],
};
