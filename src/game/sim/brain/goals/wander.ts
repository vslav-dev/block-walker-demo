import { MoveTo } from '@game/sim/brain/actions/move-to';
import { Wait } from '@game/sim/brain/actions/wait';
import type { Goal } from '@game/sim/brain/goal';
import { placeAround } from '@game/sim/brain/places';

export const WANDER_SCORE = 0.3; // a little wish that is always there: with nothing pressing, the creature wanders or rests
const DISTANCE = { min: 5, max: 14 }; // blocks
const REACH = 0.5;
const LOOK_SECONDS = { min: 1, max: 3 }; // it looks around when it gets there

// Walks to a place nearby, for no reason.
export const wanderGoal: Goal = {
  id: 'wander',
  label: 'Wander',
  score: () => WANDER_SCORE,
  plan(self, sim) {
    const place = placeAround(self, sim, DISTANCE.min, DISTANCE.max);
    if (!place) return null;
    const look = LOOK_SECONDS.min + sim.random.rand() * (LOOK_SECONDS.max - LOOK_SECONDS.min);
    return [new MoveTo(place.x, place.z, REACH), new Wait('Looking around', look)];
  },
};
