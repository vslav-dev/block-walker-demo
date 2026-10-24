import type { Readout } from '@game/core/readout';
import type { Creature } from '@game/sim/creature';
import { NEEDS } from '@game/sim/needs';
import { SIM_GROUP } from '@game/sim/sim-tuning';
import type { Simulation } from '@game/sim/simulation';

const EVENT_LINES = 5; // the last events of a creature that the panel shows, the newest first

const formatClock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

// What the simulation says of itself for the debug panel: the time, the nodes, and for every creature what it wants and does,
// its needs, what it carries and what has happened to it lately. This is how the choices of a creature are explained.
export function createSimReadouts(sim: Simulation): Readout[] {
  if (sim.creatures.length === 0 && sim.nodes.length === 0) return [];
  const readouts: Readout[] = [
    { label: 'Simulation time', group: SIM_GROUP, read: () => formatClock(sim.time) },
    { label: 'Nodes ready', group: SIM_GROUP, read: () => `${sim.nodes.filter((node) => node.ready).length} / ${sim.nodes.length}` },
  ];
  for (const creature of sim.creatures) readouts.push(...creatureReadouts(creature, sim));
  return readouts;
}

function creatureReadouts(creature: Creature, sim: Simulation): Readout[] {
  const group = `${creature.kind.label} #${creature.id}`;
  const { brain } = creature;
  const readouts: Readout[] = [];
  if (brain) {
    readouts.push(
      { label: 'Wants', group, read: () => brain.goalLabel },
      { label: 'Does', group, read: () => brain.actionLabel },
      { label: 'Last choice', group, read: () => brain.thought },
    );
  }
  for (const [id] of creature.needs.entries()) {
    readouts.push({
      label: NEEDS[id].label,
      group,
      read: () => `${creature.needs.level(id).toFixed(2)} (urgency ${creature.needs.urgency(id).toFixed(2)})`,
    });
  }
  readouts.push(
    { label: 'Carries', group, read: () => creature.inventory.describe() },
    { label: 'Position x / z', group, read: () => `${creature.body.x.toFixed(1)} / ${creature.body.z.toFixed(1)}` },
  );
  for (let line = 0; line < EVENT_LINES; line++) {
    readouts.push({
      label: `Event ${line + 1}`,
      group,
      read: () => {
        const event = sim.events.recent(creature.id, EVENT_LINES).reverse()[line];
        return event ? `${formatClock(event.time)} ${event.type}: ${event.text}` : '';
      },
    });
  }
  return readouts;
}
