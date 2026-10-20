const STORAGE_KEY = 'block-walker-tunables';

// The value as the spec allows it, or undefined if it is not one: a switch takes true or false, a number a finite
// number, kept within its range.
function fit(spec, value) {
  if (spec.boolean) return typeof value === 'boolean' ? value : undefined;
  return Number.isFinite(value) ? Math.min(spec.max, Math.max(spec.min, value)) : undefined;
}

// Numbers that shape how the game feels and are tuned by hand in the debug panel. A module lists its own as specs,
// { key, group, label, min, max, step, value } where `value` is the default; the code reads the live `values`.
// Once a number is settled, its default is changed in the spec.
// The changed values are kept in the browser, so a reload (a new world) keeps them.
// A spec with `live: true` is a number that the game moves itself (the time of day): the panel can set it, but it is
// never "changed" from its default, so it is neither kept nor reported as retuned.
// A spec with `boolean: true` is a switch, { key, group, label, boolean, value }: its value is true or false, no range.
export class Tunables {
  constructor(specs, storage = globalThis.localStorage) {
    this.specs = specs;
    this.storage = storage;
    this.byKey = new Map(specs.map((spec) => [spec.key, spec]));
    if (this.byKey.size !== specs.length) throw new Error('Two tunables share a key');
    this.values = Object.fromEntries(specs.map((spec) => [spec.key, spec.value]));
    this.load();
  }

  set(key, value) {
    const fitted = fit(this.byKey.get(key), value);
    if (fitted === undefined) return;
    this.values[key] = fitted;
    this.save();
  }

  reset(key) {
    this.set(key, this.byKey.get(key).value);
  }

  resetAll() {
    for (const spec of this.specs) this.values[spec.key] = spec.value;
    this.save();
  }

  isChanged(key) {
    const spec = this.byKey.get(key);
    return !spec.live && this.values[key] !== spec.value;
  }

  // All numbers as text to pass on: a changed one shows its default, too.
  report() {
    const lines = [];
    let group = null;
    for (const spec of this.specs) {
      if (spec.group !== group) lines.push(`${lines.length ? '\n' : ''}# ${(group = spec.group)}`);
      lines.push(`${spec.key} = ${this.values[spec.key]}${this.isChanged(spec.key) ? `   (default ${spec.value})` : ''}`);
    }
    return lines.join('\n');
  }

  load() {
    let stored;
    try {
      stored = JSON.parse(this.storage.getItem(STORAGE_KEY));
    } catch {
      return; // nothing stored, unreadable, or no storage at all
    }
    for (const [key, value] of Object.entries(stored ?? {})) {
      const fitted = this.byKey.has(key) ? fit(this.byKey.get(key), value) : undefined;
      if (fitted !== undefined) this.values[key] = fitted;
    }
  }

  save() {
    try {
      // Only what differs from the defaults, so that a default changed in the code is not hidden by an old stored copy.
      const changed = this.specs.filter((spec) => this.isChanged(spec.key)).map((spec) => [spec.key, this.values[spec.key]]);
      this.storage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(changed)));
    } catch {
      // the values then last until the page is closed
    }
  }
}
