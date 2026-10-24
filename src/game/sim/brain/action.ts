import type { Creature } from '@game/sim/creature';
import type { Simulation } from '@game/sim/simulation';

export const ActionStatus = {
  Running: 'running',
  Done: 'done',
  Failed: 'failed',
} as const;

export type ActionStatus = (typeof ActionStatus)[keyof typeof ActionStatus];

// One step of a plan: it takes time and has an effect. A creature does one action at a time, and always has one.
// A new action is a new class; plans are made of them. All state of an action is its own, a plan is made anew every time.
export interface Action {
  readonly label: string; // what the creature is doing, in words, for the panel and the label over its head
  // Can the creature drop it for something more pressing? Not so for what must be done to the end to have any use.
  readonly interruptible: boolean;
  failure?: string; // why it failed, once it has
  // Called every step of the simulation while it runs. It moves the creature by setting its velocity.
  update(self: Creature, sim: Simulation, dt: number): ActionStatus;
}
