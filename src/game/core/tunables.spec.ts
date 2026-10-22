import { Tunables, type TunableSpec } from './tunables';

const SPECS: TunableSpec[] = [
  { key: 'a', group: 'One', label: 'A', min: 0, max: 10, step: 1, value: 5 },
  { key: 'b', group: 'One', label: 'B', min: 0, max: 1, step: 0.1, value: 0.5 },
  { key: 'c', group: 'Two', label: 'C', min: -5, max: 5, step: 1, value: 0 },
];
const memory = () => {
  const items: Record<string, string> = {};
  return { items, getItem: (key: string) => items[key] ?? null, setItem: (key: string, value: string) => void (items[key] = value) };
};

describe('Tunables', () => {
  it('values start at the defaults and change within their range', () => {
    const tunables = new Tunables(SPECS, memory());
    expect(tunables.values).toEqual({ a: 5, b: 0.5, c: 0 });
    tunables.set('a', 100);
    expect(tunables.values['a'], 'clamped').toBe(10);
    tunables.set('a', Number.NaN);
    expect(tunables.values['a'], 'not a number: ignored').toBe(10);
    expect(tunables.isChanged('a')).toBe(true);
    tunables.reset('a');
    expect(tunables.values['a']).toBe(5);
    expect(tunables.isChanged('a')).toBe(false);
  });

  it('the same object is updated, so code that holds it sees the change', () => {
    const tunables = new Tunables(SPECS, memory());
    const held = tunables.values;
    tunables.set('b', 0.9);
    tunables.resetAll();
    expect(held['b']).toBe(0.5);
    tunables.set('c', 3);
    expect(held['c']).toBe(3);
  });

  it('changed values survive a reload, and a default changed in the code is not hidden by an old copy', () => {
    const storage = memory();
    const first = new Tunables(SPECS, storage);
    first.set('a', 7);
    expect(JSON.parse(storage.items['block-walker-tunables']), 'only what differs from the default').toEqual({ a: 7 });
    expect(new Tunables(SPECS, storage).values['a']).toBe(7);

    const retuned = SPECS.map((spec) => (spec.key === 'b' ? { ...spec, value: 0.8 } : spec)) as TunableSpec[];
    expect(new Tunables(retuned, storage).values['b'], 'b was never changed, it follows the new default').toBe(0.8);
  });

  it('stored garbage is ignored and no storage is no problem', () => {
    const storage = memory();
    storage.items['block-walker-tunables'] = JSON.stringify({ a: 'x', zzz: 1, c: 99 });
    const tunables = new Tunables(SPECS, storage);
    expect(tunables.values['a']).toBe(5);
    expect(tunables.values['c'], 'clamped').toBe(5);
    expect(new Tunables(SPECS, null).values['a']).toBe(5);
    expect(() => new Tunables([SPECS[0], SPECS[0]], memory())).toThrow(/share a key/);
  });

  it('the report lists every number by group and shows the default of a changed one', () => {
    const tunables = new Tunables(SPECS, memory());
    tunables.set('b', 0.9);
    expect(tunables.report()).toBe(['# One', 'a = 5', 'b = 0.9   (default 0.5)', '', '# Two', 'c = 0'].join('\n'));
  });

  it('a switch takes only true or false, is kept when changed and reported like a number', () => {
    const specs: TunableSpec[] = [...SPECS, { key: 'line', group: 'Two', label: 'Line', boolean: true, value: true }];
    const storage = memory();
    const tunables = new Tunables(specs, storage);
    expect(tunables.values['line']).toBe(true);
    tunables.set('line', 1);
    tunables.set('line', 'no');
    expect(tunables.values['line'], 'not a boolean: ignored').toBe(true);
    tunables.set('line', false);
    expect(tunables.isChanged('line')).toBe(true);
    expect(new Tunables(specs, storage).values['line'], 'kept').toBe(false);
    expect(tunables.report().endsWith('line = false   (default true)')).toBe(true);
    storage.items['block-walker-tunables'] = JSON.stringify({ line: 0 });
    expect(new Tunables(specs, storage).values['line'], 'a stored non-boolean is ignored').toBe(true);
    tunables.reset('line');
    expect(tunables.values['line']).toBe(true);
  });

  it('a number that the game moves is neither kept nor reported as retuned', () => {
    const specs: TunableSpec[] = [...SPECS, { key: 'hour', group: 'Two', label: 'Hour', min: 0, max: 24, step: 1, value: 10, live: true }];
    const storage = memory();
    const tunables = new Tunables(specs, storage);
    (tunables.values as Record<string, number>)['hour'] = 15; // the game moves it
    tunables.set('a', 7);
    expect(tunables.isChanged('hour')).toBe(false);
    expect(JSON.parse(storage.items['block-walker-tunables']), 'the hour is not stored').toEqual({ a: 7 });
    expect(new Tunables(specs, storage).values['hour'], 'a new world starts at the default hour').toBe(10);
    tunables.set('hour', 30);
    expect(tunables.values['hour'], 'the panel can still set it, within the range').toBe(24);
    expect(tunables.report().endsWith('hour = 24'), 'and it is reported without a default').toBe(true);
  });

  it('an unknown key is an error', () => {
    expect(() => new Tunables(SPECS, memory()).set('zzz', 1)).toThrow(/Unknown tunable/);
  });
});
