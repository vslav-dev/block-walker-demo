import { SIM_DT, runFor, simOf } from '@game/testing/sim';
import { flatWorld } from '@game/testing/worlds';
import { Creature } from '@game/sim/creature';
import type { CreatureKind } from '@game/sim/creature-kind';
import { EventType } from '@game/sim/event-log';
import type { Simulation } from '@game/sim/simulation';
import { StatId } from '@game/sim/stats';
import { ActionStatus, type Action } from './action';
import { Wait } from './actions/wait';
import type { Goal } from './goal';

// A goal with the score and the plan the test gives it.
const goal = (id: string, score: () => number, plan: () => Action[] | null): Goal => ({ id, label: id, score, plan });
const waiting = (seconds: number) => () => [new Wait(`${seconds}s`, seconds)];

class Stubborn implements Action {
  readonly label = 'stubborn';
  readonly interruptible = false;
  private elapsed = 0;
  update(_self: unknown, _sim: unknown, dt: number): ActionStatus {
    this.elapsed += dt;
    return this.elapsed < 10 ? ActionStatus.Running : ActionStatus.Done;
  }
}

class Failing implements Action {
  readonly label = 'failing';
  readonly interruptible = true;
  failure = 'for the test';
  update(): ActionStatus {
    return ActionStatus.Failed;
  }
}

// A creature with no needs and the goals the test gives it, alone in a small world.
function mind(goals: Goal[]) {
  const sim = simOf(flatWorld(), {});
  const kind: CreatureKind = { label: 'Test', stats: { [StatId.WalkSpeed]: 3, [StatId.SightRadius]: 9 }, needs: [], goals };
  const creature = new Creature(1, kind, sim.world, 4.5, 4.5, sim.random);
  sim.creatures.push(creature);
  return { sim, brain: creature.brain! };
}

// The ids of the goals chosen from `from` to `to` seconds, in order.
const chosen = (sim: Simulation, from: number, to = Infinity) =>
  sim.events
    .all()
    .filter((event) => event.type === EventType.Decided && event.time > from && event.time < to)
    .map((event) => event.text.split('→ ')[1]);

describe('Brain', () => {
  it('picks a goal and carries out its plan', () => {
    const { sim, brain } = mind([goal('a', () => 0.5, () => [new Wait('first', 1), new Wait('second', 1)])]);
    sim.update(SIM_DT);
    expect([brain.goalLabel, brain.actionLabel]).toEqual(['a', 'first']);
    runFor(sim, 1.2);
    expect(brain.actionLabel).toBe('second');
  });

  it('with something pressing the others have no chance; with nothing pressing all of them have', () => {
    const pressing = mind([goal('a', () => 2, waiting(0.05)), goal('b', () => 0.3, waiting(0.05))]);
    runFor(pressing.sim, 20);
    const picks = chosen(pressing.sim, 0);
    expect(picks.length).toBeGreaterThan(100);
    expect(new Set(picks)).toEqual(new Set(['a']));

    const calm = mind([goal('a', () => 0.3, waiting(0.05)), goal('b', () => 0.25, waiting(0.05))]);
    runFor(calm.sim, 20);
    const counts = new Map<string, number>();
    for (const id of chosen(calm.sim, 0)) counts.set(id, (counts.get(id) ?? 0) + 1);
    expect(counts.get('a')).toBeGreaterThan(30);
    expect(counts.get('b')).toBeGreaterThan(30);
  });

  it('keeps its goal against one that is a little better, and leaves it for one that is clearly better', () => {
    let rival = 0;
    const { sim, brain } = mind([goal('a', () => 0.3, waiting(100)), goal('b', () => rival, waiting(100))]);
    sim.update(SIM_DT);
    expect(brain.goalLabel).toBe('a');

    rival = 0.4; // better than 0.3, but not by more than the goal in hand is worth extra
    runFor(sim, 3);
    expect(brain.goalLabel).toBe('a');

    rival = 0.5;
    runFor(sim, 1.5);
    expect(brain.goalLabel).toBe('b');
    expect(sim.events.all().filter((event) => event.type === EventType.Interrupted)).toHaveLength(1);
  });

  it('does not leave an action that must be done to the end', () => {
    let rival = 0;
    const { sim, brain } = mind([goal('a', () => 0.3, () => [new Stubborn()]), goal('b', () => rival, waiting(100))]);
    sim.update(SIM_DT);
    rival = 5;
    runFor(sim, 5);
    expect(brain.actionLabel).toBe('stubborn');
    runFor(sim, 6); // the action is over: now it is free to go
    expect(brain.goalLabel).toBe('b');
  });

  it('a goal whose action failed is set aside for a while, then tried again', () => {
    const { sim, brain } = mind([goal('f', () => 1, () => [new Failing()]), goal('g', () => 0.3, waiting(0.5))]);
    runFor(sim, 20);
    const failures = sim.events.all().filter((event) => event.type === EventType.Failed);
    expect(failures.length).toBeGreaterThan(1);
    expect(failures[0].text).toContain('for the test');

    const first = failures[0].time;
    expect(chosen(sim, first, first + 5), 'while it is set aside').not.toContain('f');
    expect(brain.actionLabel).not.toBe('—');
    expect(failures[1].time - first, 'the pause is as long as it is').toBeGreaterThan(5);
  });

  it('a goal with no way to its end is passed over, and when none has one the creature idles', () => {
    const open = mind([goal('a', () => 1, () => null), goal('b', () => 0.3, waiting(1))]);
    open.sim.update(SIM_DT);
    expect(open.brain.goalLabel).toBe('b');

    const shut = mind([goal('a', () => 1, () => null)]);
    shut.sim.update(SIM_DT);
    expect(shut.brain.actionLabel).toBe('Idling');
  });

  it('has an action at the end of every step, whatever happens', () => {
    let rival = 0;
    const { sim, brain } = mind([
      goal('a', () => 0.3, waiting(0.2)),
      goal('f', () => rival, () => [new Failing()]),
      goal('n', () => rival / 2, () => null),
    ]);
    runFor(sim, 60, () => {
      rival = Math.sin(sim.time) + 0.5;
      expect(brain.actionLabel).not.toBe('—');
    });
  });
});
