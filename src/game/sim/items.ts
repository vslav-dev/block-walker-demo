import { NeedId } from './needs';

export const ItemId = {
  Berries: 'berries',
} as const;

export type ItemId = (typeof ItemId)[keyof typeof ItemId];

// A new item is a new line here. `relieves` is what it does for a need when it is used up.
export interface ItemDef {
  label: string;
  relieves?: { need: NeedId; amount: number };
}

export const ITEMS: Record<ItemId, ItemDef> = {
  [ItemId.Berries]: { label: 'berries', relieves: { need: NeedId.Hunger, amount: 0.2 } },
};

const ALL_ITEMS = Object.keys(ITEMS) as ItemId[];

// The items that bring the need down.
export const itemsRelieving = (need: NeedId): ItemId[] => ALL_ITEMS.filter((item) => ITEMS[item].relieves?.need === need);

// What a creature carries: a count per kind of item.
export class Inventory {
  private readonly counts = new Map<ItemId, number>();

  count(item: ItemId): number {
    return this.counts.get(item) ?? 0;
  }

  add(item: ItemId, amount: number): void {
    this.counts.set(item, this.count(item) + amount);
  }

  // Takes one of the item out, false if there is none.
  take(item: ItemId): boolean {
    if (this.count(item) === 0) return false;
    this.counts.set(item, this.count(item) - 1);
    return true;
  }

  // The first of these items that the inventory has, in the order given.
  firstOf(items: readonly ItemId[]): ItemId | null {
    return items.find((item) => this.count(item) > 0) ?? null;
  }

  describe(): string {
    const parts = [...this.counts].filter(([, count]) => count > 0).map(([item, count]) => `${count} ${ITEMS[item].label}`);
    return parts.length ? parts.join(', ') : 'nothing';
  }
}
