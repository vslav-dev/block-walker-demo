import type { Action } from '@game/sim/brain/action';
import type { Creature } from '@game/sim/creature';
import type { Simulation } from '@game/sim/simulation';

// Something a creature may want. It says how much it wants it now and, when it comes to it, how to get it. A creature has the
// goals of its kind; a new goal is a new object, added to the kinds that have it.
export interface Goal {
  readonly id: string; // short, for the log
  readonly label: string;
  // How much the creature wants it now: 0 not at all, 1 it presses, above 1 it overrides what else there is. Everything that
  // makes a creature want something (needs, fears, the company of others) is in here, as one number.
  score(self: Creature, sim: Simulation): number;
  // The steps to get it, in order, or null if there is no way now (nothing to eat anywhere in sight is still a way: to look for it).
  plan(self: Creature, sim: Simulation): Action[] | null;
}
