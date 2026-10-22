import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TunableControl } from '@app/components/tunable-control/tunable-control';
import { TunablesService } from '@app/services/tunables.service';
import type { TunableSpec } from '@game/core/tunables';

// A line of the state in a section: what it is and what it is now.
export interface ReadoutLine {
  label: string;
  value: string;
}

// A section of the debug panel: the state of a group and the tunable numbers of the group. The sections share a name, so
// that the browser keeps one of them open at most.
@Component({
  selector: 'debug-section',
  templateUrl: './debug-section.html',
  styleUrl: './debug-section.scss',
  imports: [TunableControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebugSection {
  public readonly groupInput = input.required<string>();
  public readonly readoutsInput = input.required<readonly ReadoutLine[]>();
  public readonly specsInput = input.required<readonly TunableSpec[]>();

  private readonly tunables = inject(TunablesService);

  protected readonly view$$ = this.tunables.view$$;

  protected set(key: string, value: number | boolean): void {
    this.tunables.set(key, value);
  }

  protected reset(key: string): void {
    this.tunables.reset(key);
  }

  protected setEditing(key: string, editing: boolean): void {
    if (editing) this.tunables.beginEdit(key);
    else this.tunables.endEdit();
  }
}
