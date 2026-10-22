import { Injectable, signal } from '@angular/core';
import { Tunables, type TunableValue } from '@game/core/tunables';
import { GAME_TUNABLES, type GameTuning } from '@game/tuning';

// What the debug panel shows of the tunable numbers: the value of every one, by key, and the keys that differ from their defaults.
export interface TunablesView {
  values: Record<string, TunableValue>;
  changed: ReadonlySet<string>;
}

// The tunable numbers of the game (see GAME_TUNABLES), for the debug panel to change. The game reads `values`, one object
// that is changed in place, so a change shows at once; the panel reads `view$$`, which is a new copy after every change.
@Injectable({
  providedIn: 'root',
})
export class TunablesService {
  private readonly registry = new Tunables<GameTuning>(GAME_TUNABLES);
  private editingKey: string | null = null;

  readonly specs = this.registry.specs;
  readonly values = this.registry.values;
  readonly view$$ = signal(this.snapshot());

  set(key: string, value: unknown): void {
    this.registry.set(key, value);
    this.view$$.set(this.snapshot());
  }

  reset(key: string): void {
    this.registry.reset(key);
    this.view$$.set(this.snapshot());
  }

  resetAll(): void {
    this.registry.resetAll();
    this.view$$.set(this.snapshot());
  }

  // All numbers as text to pass on: a changed one shows its default, too.
  report(): string {
    return this.registry.report();
  }

  // The number is in a hand (its control has the focus): the game moving it does not redraw the control, or the hand would fight it.
  beginEdit(key: string): void {
    this.editingKey = key;
  }

  endEdit(): void {
    this.editingKey = null;
  }

  // Takes into the view what the game has changed on its own since, the time of day.
  syncGameChanges(): void {
    const next = this.snapshot();
    if (this.editingKey !== null) next.values[this.editingKey] = this.view$$().values[this.editingKey];
    this.view$$.set(next);
  }

  private snapshot(): TunablesView {
    return {
      values: { ...this.values },
      changed: new Set(this.specs.filter((spec) => this.registry.isChanged(spec.key)).map((spec) => spec.key)),
    };
  }
}
