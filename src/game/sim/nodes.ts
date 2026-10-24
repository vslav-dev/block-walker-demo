import type { EntityId } from './entity';
import { ItemId } from './items';

export const NodeKindId = {
  BerryBush: 'berryBush',
} as const;

export type NodeKindId = (typeof NodeKindId)[keyof typeof NodeKindId];

// A kind of node of the world: something that stands where it stands and gives an item to whoever gathers it, then grows it
// back. A new kind is a new line here.
export interface NodeKind {
  label: string;
  item: ItemId;
  amount: number; // how many of the item one gathering gives
  gatherSeconds: number;
  regrowSeconds: number; // from nothing to full
}

export const NODE_KINDS: Record<NodeKindId, NodeKind> = {
  [NodeKindId.BerryBush]: { label: 'berry bush', item: ItemId.Berries, amount: 3, gatherSeconds: 4, regrowSeconds: 120 },
};

// The node kinds that give one of these items.
export const nodeKindsGiving = (items: readonly ItemId[]): Set<NodeKindId> =>
  new Set((Object.keys(NODE_KINDS) as NodeKindId[]).filter((kind) => items.includes(NODE_KINDS[kind].item)));

// A node in the world. It is full (ready to gather) or growing back; gathering empties it.
export class ResourceNode {
  constructor(
    readonly id: EntityId,
    readonly kind: NodeKindId,
    readonly x: number,
    readonly z: number,
    public fullness: number, // 0..1
  ) {}

  get def(): NodeKind {
    return NODE_KINDS[this.kind];
  }

  get ready(): boolean {
    return this.fullness >= 1;
  }

  update(dt: number): void {
    if (!this.ready) this.fullness = Math.min(1, this.fullness + dt / this.def.regrowSeconds);
  }

  // Takes what has grown on the node: the amount of the item, or nothing if it is not ready.
  harvest(): number {
    if (!this.ready) return 0;
    this.fullness = 0;
    return this.def.amount;
  }
}
