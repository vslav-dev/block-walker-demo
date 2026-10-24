import { Inventory, ITEMS, ItemId, itemsRelieving } from './items';
import { NeedId } from './needs';
import { NODE_KINDS, NodeKindId, ResourceNode, nodeKindsGiving } from './nodes';

const BUSH = NODE_KINDS[NodeKindId.BerryBush];

describe('ResourceNode', () => {
  it('a full node gives its amount once and is empty after', () => {
    const bush = new ResourceNode(1, NodeKindId.BerryBush, 0, 0, 1);
    expect(bush.ready).toBe(true);
    expect(bush.harvest()).toBe(BUSH.amount);
    expect(bush.ready).toBe(false);
    expect(bush.harvest()).toBe(0);
  });

  it('an empty node grows back in its time, and not before', () => {
    const bush = new ResourceNode(1, NodeKindId.BerryBush, 0, 0, 0);
    bush.update(BUSH.regrowSeconds * 0.99);
    expect(bush.ready).toBe(false);
    bush.update(BUSH.regrowSeconds * 0.02);
    expect(bush.ready).toBe(true);
    expect(bush.fullness).toBe(1);
  });

  it('what relieves hunger is berries, and berries grow on bushes', () => {
    expect(itemsRelieving(NeedId.Hunger)).toEqual([ItemId.Berries]);
    expect(nodeKindsGiving([ItemId.Berries])).toEqual(new Set([NodeKindId.BerryBush]));
    expect(nodeKindsGiving([])).toEqual(new Set());
  });
});

describe('Inventory', () => {
  it('counts what is put in and takes one at a time', () => {
    const inventory = new Inventory();
    expect(inventory.describe()).toBe('nothing');
    inventory.add(ItemId.Berries, 3);
    expect(inventory.count(ItemId.Berries)).toBe(3);
    expect(inventory.describe()).toBe(`3 ${ITEMS[ItemId.Berries].label}`);
    expect(inventory.take(ItemId.Berries)).toBe(true);
    expect(inventory.count(ItemId.Berries)).toBe(2);
  });

  it('cannot take what it has not', () => {
    const inventory = new Inventory();
    expect(inventory.take(ItemId.Berries)).toBe(false);
    expect(inventory.count(ItemId.Berries)).toBe(0);
    expect(inventory.firstOf([ItemId.Berries])).toBeNull();
    inventory.add(ItemId.Berries, 1);
    expect(inventory.firstOf([ItemId.Berries])).toBe(ItemId.Berries);
  });
});
