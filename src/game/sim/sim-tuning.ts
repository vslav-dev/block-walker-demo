import type { TunableSpec } from '@game/core/tunables';

// The numbers of the simulation that the debug panel tunes.
export interface SimTuning {
  simSpeed: number;
  creatureLabels: boolean;
}

export const SIM_GROUP = 'Simulation';

export const SIM_TUNABLES: readonly TunableSpec[] = [
  { key: 'simSpeed', group: SIM_GROUP, label: 'Speed of the simulation (0 = stopped)', min: 0, max: 30, step: 0.5, value: 1 },
  { key: 'creatureLabels', group: SIM_GROUP, label: 'What creatures do, over their heads', boolean: true, value: true },
];
