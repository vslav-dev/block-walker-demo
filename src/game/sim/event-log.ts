import type { EntityId } from './entity';

export const EventType = {
  Decided: 'decided', // a creature chose what to do, and from what
  Interrupted: 'interrupted', // something became more pressing than what it was doing
  Failed: 'failed', // an action could not be done, and why
  Gathered: 'gathered',
  Ate: 'ate',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

// One thing that happened in the simulation: when, to whom, what kind of thing, and the story in words.
export interface SimEvent {
  time: number; // seconds of the simulation
  who: EntityId;
  type: EventType;
  text: string;
}

const CAPACITY = 500;

// The events of the simulation, the newest last; the oldest are forgotten when there are too many. It is written to and never
// read by the simulation itself, so it cannot change what happens: the panel and the tests read it.
export class EventLog {
  private readonly events: SimEvent[] = [];

  push(event: SimEvent): void {
    this.events.push(event);
    if (this.events.length > CAPACITY) this.events.shift();
  }

  // The last `count` events of one creature, the oldest first.
  recent(who: EntityId, count: number): SimEvent[] {
    return this.events.filter((event) => event.who === who).slice(-count);
  }

  all(): readonly SimEvent[] {
    return this.events;
  }
}
