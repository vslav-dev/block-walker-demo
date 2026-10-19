import test from 'node:test';
import assert from 'node:assert/strict';
import { Tunables } from '../src/tunables.js';

const SPECS = [
  { key: 'a', group: 'One', label: 'A', min: 0, max: 10, step: 1, value: 5 },
  { key: 'b', group: 'One', label: 'B', min: 0, max: 1, step: 0.1, value: 0.5 },
  { key: 'c', group: 'Two', label: 'C', min: -5, max: 5, step: 1, value: 0 },
];
const memory = () => ({ items: {}, getItem(key) { return this.items[key] ?? null; }, setItem(key, value) { this.items[key] = value; } });

test('values start at the defaults and change within their range', () => {
  const tunables = new Tunables(SPECS, memory());
  assert.deepEqual(tunables.values, { a: 5, b: 0.5, c: 0 });
  tunables.set('a', 100);
  assert.equal(tunables.values.a, 10, 'clamped');
  tunables.set('a', Number.NaN);
  assert.equal(tunables.values.a, 10, 'not a number: ignored');
  assert.equal(tunables.isChanged('a'), true);
  tunables.reset('a');
  assert.equal(tunables.values.a, 5);
  assert.equal(tunables.isChanged('a'), false);
});

test('the same object is updated, so code that holds it sees the change', () => {
  const tunables = new Tunables(SPECS, memory());
  const held = tunables.values;
  tunables.set('b', 0.9);
  tunables.resetAll();
  assert.equal(held.b, 0.5);
  tunables.set('c', 3);
  assert.equal(held.c, 3);
});

test('changed values survive a reload, and a default changed in the code is not hidden by an old copy', () => {
  const storage = memory();
  const first = new Tunables(SPECS, storage);
  first.set('a', 7);
  assert.deepEqual(JSON.parse(storage.items['block-walker-tunables']), { a: 7 }, 'only what differs from the default');
  assert.equal(new Tunables(SPECS, storage).values.a, 7);

  const retuned = SPECS.map((spec) => (spec.key === 'b' ? { ...spec, value: 0.8 } : spec));
  assert.equal(new Tunables(retuned, storage).values.b, 0.8, 'b was never changed, it follows the new default');
});

test('stored garbage is ignored and no storage is no problem', () => {
  const storage = memory();
  storage.items['block-walker-tunables'] = JSON.stringify({ a: 'x', zzz: 1, c: 99 });
  const tunables = new Tunables(SPECS, storage);
  assert.equal(tunables.values.a, 5);
  assert.equal(tunables.values.c, 5, 'clamped');
  assert.equal(new Tunables(SPECS, null).values.a, 5);
  assert.throws(() => new Tunables([SPECS[0], SPECS[0]], memory()), /share a key/);
});

test('the report lists every number by group and shows the default of a changed one', () => {
  const tunables = new Tunables(SPECS, memory());
  tunables.set('b', 0.9);
  assert.equal(tunables.report(), ['# One', 'a = 5', 'b = 0.9   (default 0.5)', '', '# Two', 'c = 0'].join('\n'));
});
