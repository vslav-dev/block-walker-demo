import { ActionStatus, type Action } from '@game/sim/brain/action';
import { Wait } from '@game/sim/brain/actions/wait';
import { pickWeighted } from '@game/sim/brain/choose';
import type { Goal } from '@game/sim/brain/goal';
import type { Creature } from '@game/sim/creature';
import { EventType } from '@game/sim/event-log';
import type { Simulation } from '@game/sim/simulation';

const TEMPERATURE = 0.08; // how much chance there is in a choice: goals 0.1 apart in score are chosen about 3 to 1
const REVIEW_SECONDS = 1; // how often a creature on the way asks itself whether something has become more pressing
const STICKINESS = 0.15; // what the goal in hand is worth more than its score: the creature does not dither between near goals
const SULK_SECONDS = 6; // a goal whose action failed is left alone this long
const IDLE_SECONDS = 1;

interface Candidate {
  goal: Goal;
  score: number;
}

const describe = (candidates: readonly Candidate[]): string => candidates.map(({ goal, score }) => `${goal.id} ${score.toFixed(2)}`).join(' · ');

// The mind of a creature: it wants things (the goals of its kind), picks one, makes a plan for it, and carries the plan out one
// action at a time. It always has an action.
//
// - Picking is by chance, weighted by how much each goal is wanted: with nothing pressing it wanders about, rests, does as it
//   pleases; with a need that presses the others have next to no chance.
// - Once a goal is picked it is kept, until it is done or fails, or something else is wanted clearly more (checked every
//   REVIEW_SECONDS, without chance, and only where the action can be left). The goal in hand is worth STICKINESS more.
// - A failed action drops the plan and sets its goal aside for a while; the creature then picks again.
export class Brain {
  private goal: Goal | null = null;
  private action: Action | null = null;
  private steps: Action[] = []; // after the action
  private sinceReview = 0;
  private readonly sulkingUntil = new Map<Goal, number>();
  private lastThought = '';

  constructor(private readonly goals: readonly Goal[]) {}

  get goalLabel(): string {
    return this.goal?.label ?? '—';
  }

  get actionLabel(): string {
    return this.action?.label ?? '—';
  }

  // The scores of the last choice and what was chosen, for the panel.
  get thought(): string {
    return this.lastThought;
  }

  // One step of the mind. It ends with an action in hand, always: when one is over, the next is taken at once.
  update(self: Creature, sim: Simulation, dt: number): void {
    this.sinceReview += dt;
    if (this.action?.interruptible && this.sinceReview >= REVIEW_SECONDS) this.review(self, sim);
    if (!this.action) this.next(self, sim); // the first step of its life

    const action = this.action!;
    const status = action.update(self, sim, dt);
    if (status === ActionStatus.Running) return;
    if (status === ActionStatus.Failed) this.drop(self, sim, action);
    this.next(self, sim);
  }

  private next(self: Creature, sim: Simulation): void {
    this.action = this.steps.shift() ?? null;
    if (!this.action) this.choose(self, sim);
  }

  private choose(self: Creature, sim: Simulation): void {
    const pool = this.candidates(self, sim);
    const scores = describe(pool);
    while (pool.length > 0) {
      const i = pickWeighted(pool.map((candidate) => candidate.score), TEMPERATURE, sim.random.rand);
      const { goal } = pool[i];
      const plan = goal.plan(self, sim);
      if (plan?.length) {
        this.lastThought = `${scores} → ${goal.id}`;
        sim.log(self.id, EventType.Decided, this.lastThought);
        this.commit(goal, plan);
        return;
      }
      pool.splice(i, 1); // no way to it now
    }
    this.goal = null;
    this.lastThought = 'nothing to do';
    this.action = new Wait('Idling', IDLE_SECONDS);
  }

  // No chance in this: the best goal other than the one in hand takes over if it is wanted more than the one in hand plus STICKINESS.
  private review(self: Creature, sim: Simulation): void {
    this.sinceReview = 0;
    const pool = this.candidates(self, sim);
    const held = this.goal ? (pool.find((candidate) => candidate.goal === this.goal)?.score ?? 0) + STICKINESS : 0;
    let challenger: Candidate | null = null;
    for (const candidate of pool) {
      if (candidate.goal !== this.goal && candidate.score > (challenger?.score ?? held)) challenger = candidate;
    }
    const plan = challenger?.goal.plan(self, sim);
    if (!challenger || !plan?.length) return;

    this.lastThought = `${describe(pool)} → ${challenger.goal.id}`;
    sim.log(self.id, EventType.Interrupted, `${this.goal?.id ?? 'idle'} ${held.toFixed(2)} < ${challenger.goal.id} ${challenger.score.toFixed(2)}`);
    this.commit(challenger.goal, plan);
  }

  private commit(goal: Goal, plan: Action[]): void {
    this.goal = goal;
    this.action = plan[0];
    this.steps = plan.slice(1);
    this.sinceReview = 0;
  }

  private drop(self: Creature, sim: Simulation, action: Action): void {
    sim.log(self.id, EventType.Failed, `${action.label}: ${action.failure ?? 'failed'}${this.goal ? `, ${this.goal.id} set aside` : ''}`);
    if (this.goal) this.sulkingUntil.set(this.goal, sim.time + SULK_SECONDS);
    this.goal = null;
    this.steps = [];
  }

  // The goals that are wanted at all and not set aside, with how much.
  private candidates(self: Creature, sim: Simulation): Candidate[] {
    return this.goals
      .filter((goal) => (this.sulkingUntil.get(goal) ?? 0) <= sim.time)
      .map((goal) => ({ goal, score: goal.score(self, sim) }))
      .filter((candidate) => candidate.score > 0);
  }
}
