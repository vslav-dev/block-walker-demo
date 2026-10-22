const STORAGE_KEY = 'block-walker-tunables';

interface TunableBase {
  key: string;
  group: string;
  label: string;
}

export interface NumberTunable extends TunableBase {
  min: number;
  max: number;
  step: number;
  value: number;
  live?: boolean;
  boolean?: undefined;
}

export interface SwitchTunable extends TunableBase {
  boolean: true;
  value: boolean;
  live?: undefined;
}

export type TunableSpec = NumberTunable | SwitchTunable;
export type TunableValue = number | boolean;

// What the registry needs of the browser's storage.
export type TunableStorage = Pick<Storage, 'getItem' | 'setItem'>;

// The value as the spec allows it, or undefined if it is not one: a switch takes true or false, a number a finite
// number, kept within its range.
function fit(spec: TunableSpec, value: unknown): TunableValue | undefined {
  if (spec.boolean) return typeof value === 'boolean' ? value : undefined;
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(spec.max, Math.max(spec.min, value)) : undefined;
}

// Numbers that shape how the game feels and are tuned by hand in the debug panel. A module lists its own as specs,
// { key, group, label, min, max, step, value } where `value` is the default; the code reads the live `values`.
// Once a number is settled, its default is changed in the spec.
// The changed values are kept in the browser, so a reload (a new world) keeps them.
// A spec with `live: true` is a number that the game moves itself (the time of day): the panel can set it, but it is
// never "changed" from its default, so it is neither kept nor reported as retuned.
// A spec with `boolean: true` is a switch, { key, group, label, boolean, value }: its value is true or false, no range.
// T is the shape of `values`: the keys of the specs, which the code that lists them knows.
export class Tunables<T extends object = Record<string, TunableValue>> {
  readonly values: T;
  private readonly byKey: Map<string, TunableSpec>;

  constructor(
    readonly specs: readonly TunableSpec[],
    private readonly storage: TunableStorage | null | undefined = globalThis.localStorage,
  ) {
    this.byKey = new Map(specs.map((spec) => [spec.key, spec]));
    if (this.byKey.size !== specs.length) throw new Error('Two tunables share a key');
    this.values = Object.fromEntries(specs.map((spec) => [spec.key, spec.value])) as T;
    this.load();
  }

  set(key: string, value: unknown): void {
    const fitted = fit(this.specOf(key), value);
    if (fitted === undefined) return;
    this.store()[key] = fitted;
    this.save();
  }

  reset(key: string): void {
    this.set(key, this.specOf(key).value);
  }

  resetAll(): void {
    for (const spec of this.specs) this.store()[spec.key] = spec.value;
    this.save();
  }

  isChanged(key: string): boolean {
    const spec = this.specOf(key);
    return !spec.live && this.store()[key] !== spec.value;
  }

  // All numbers as text to pass on: a changed one shows its default, too.
  report(): string {
    const lines: string[] = [];
    let group: string | null = null;
    for (const spec of this.specs) {
      if (spec.group !== group) lines.push(`${lines.length ? '\n' : ''}# ${(group = spec.group)}`);
      lines.push(`${spec.key} = ${this.store()[spec.key]}${this.isChanged(spec.key) ? `   (default ${spec.value})` : ''}`);
    }
    return lines.join('\n');
  }

  private specOf(key: string): TunableSpec {
    const spec = this.byKey.get(key);
    if (!spec) throw new Error(`Unknown tunable "${key}"`);
    return spec;
  }

  private store(): Record<string, TunableValue> {
    return this.values as Record<string, TunableValue>;
  }

  private load(): void {
    let stored: unknown;
    try {
      stored = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null');
    } catch {
      return; // unreadable
    }
    for (const [key, value] of Object.entries(stored ?? {})) {
      const spec = this.byKey.get(key);
      const fitted = spec ? fit(spec, value) : undefined;
      if (fitted !== undefined) this.store()[key] = fitted;
    }
  }

  private save(): void {
    try {
      // Only what differs from the defaults, so that a default changed in the code is not hidden by an old stored copy.
      const changed = this.specs.filter((spec) => this.isChanged(spec.key)).map((spec) => [spec.key, this.store()[spec.key]]);
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(changed)));
    } catch {
      // the values then last until the page is closed
    }
  }
}
