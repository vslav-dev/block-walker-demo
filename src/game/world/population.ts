import type { CreatureKindId } from '@game/sim/creature-kind';
import type { NodeKindId } from '@game/sim/nodes';

// What a generator puts into its world to live in it: where, and of what kind. It is a description, not the living things: what
// they are and how they act is for the simulation to say, so a generator needs to know nothing of that.
export interface NodeSpawn {
  kind: NodeKindId;
  x: number;
  z: number;
  fullness: number; // 0..1: 1 is ready to gather, less is growing back
}

export interface CreatureSpawn {
  kind: CreatureKindId;
  x: number;
  z: number;
}

export interface Population {
  nodes: NodeSpawn[];
  creatures: CreatureSpawn[];
}
