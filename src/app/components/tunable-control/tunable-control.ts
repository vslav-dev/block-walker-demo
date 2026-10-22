import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { TunableSpec, TunableValue } from '@game/core/tunables';

// The control of one tunable number: a slider and a field for a number, a checkbox for a switch, and a reset to the default.
@Component({
  selector: 'tunable-control',
  templateUrl: './tunable-control.html',
  styleUrl: './tunable-control.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TunableControl {
  public readonly specInput = input.required<TunableSpec>();
  public readonly valueInput = input.required<TunableValue>();
  public readonly changedInput = input.required<boolean>();

  public readonly changeOutput = output<number | boolean>();
  public readonly resetOutput = output<void>();
  // true when a control of the number gets the focus, false when it loses it
  public readonly editOutput = output<boolean>();

  protected readonly numberSpec$$ = computed(() => {
    const spec = this.specInput();
    return spec.boolean ? null : spec;
  });
  protected readonly switchSpec$$ = computed(() => {
    const spec = this.specInput();
    return spec.boolean ? spec : null;
  });
  protected readonly numberValue$$ = computed(() => Number(this.valueInput()));
  protected readonly checked$$ = computed(() => this.valueInput() === true);
}
