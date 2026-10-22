import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DebugSection, type ReadoutLine } from '@app/components/debug-section/debug-section';
import { DebugMode, DebugService } from '@app/services/debug.service';
import { GameService } from '@app/services/game.service';
import { TunablesService } from '@app/services/tunables.service';
import type { TunableSpec } from '@game/core/tunables';
import { fromEvent } from 'rxjs';

const REFRESH_MILLISECONDS = 100; // how often the readouts are redrawn
const TOGGLE_KEY = 'F3';

interface Section {
  group: string;
  readouts: ReadoutLine[];
  specs: TunableSpec[];
}

// The debug panel at the side of the screen, F3 goes through off, the whole panel and only the frame rate in a tiny box
// (the mode is kept between reloads). The game keeps running behind it.
// - State: the readouts of the game, redrawn a few times a second.
// - Tunables: a slider and a number for each (a checkbox for a switch), with a reset. They take effect at once and are kept between reloads.
// - Sections: an accordion, one section per group of tunables (and the readouts of that group), only one open at a time.
// - Copy: all numbers and the readouts as text, to pass on.
// A new tunable or readout needs no markup: the sections are built from the lists.
@Component({
  selector: 'debug-panel',
  templateUrl: './debug-panel.html',
  styleUrl: './debug-panel.scss',
  imports: [DebugSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebugPanel {
  private readonly reportElem = viewChild<ElementRef<HTMLTextAreaElement>>('reportElem');
  private readonly debugService = inject(DebugService);
  private readonly gameService = inject(GameService);
  private readonly tunables = inject(TunablesService);
  private readonly injector = inject(Injector);

  private readonly readoutValues$$ = signal<readonly string[]>([]);
  private readonly readoutLines$$ = computed(() => {
    const values = this.readoutValues$$();
    return this.gameService.readouts$$().map(({ label, group }, i) => ({ label, group, value: values[i] ?? '' }));
  });

  protected readonly isOff$$ = computed(() => this.debugService.mode$$() === DebugMode.Off);
  protected readonly isFull$$ = computed(() => this.debugService.mode$$() === DebugMode.Full);
  protected readonly isFps$$ = computed(() => this.debugService.mode$$() === DebugMode.Fps);
  // The readouts of no group go to the header, at its left.
  protected readonly headerReadouts$$ = computed(() => this.readoutLines$$().filter((line) => line.group === null));
  protected readonly sections$$ = computed(() => {
    const sections = new Map<string, Section>();
    const section = (group: string): Section => {
      let found = sections.get(group);
      if (!found) sections.set(group, (found = { group, readouts: [], specs: [] }));
      return found;
    };
    for (const spec of this.tunables.specs) section(spec.group).specs.push(spec);
    for (const { group, label, value } of this.readoutLines$$()) {
      if (group !== null) section(group).readouts.push({ label, value });
    }
    return [...sections.values()];
  });
  // The numbers and the state as text, in the box below, where it can be selected by hand.
  protected readonly report$$ = signal<string | null>(null);

  constructor() {
    // Capture phase: the toggle works also while a control of the panel has the focus.
    fromEvent<KeyboardEvent>(window, 'keydown', { capture: true })
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event.code !== TOGGLE_KEY || event.repeat) return;
        event.preventDefault();
        this.debugService.cycleMode();
      });

    // While the panel is open the readouts are drawn at once and then a few times a second; the numbers that the game moves
    // (the time of day) are taken into the controls with them.
    effect((onCleanup) => {
      const readouts = this.gameService.readouts$$();
      if (this.isOff$$()) return;
      const refresh = (): void => {
        this.readoutValues$$.set(readouts.map((readout) => readout.read()));
        this.tunables.syncGameChanges();
      };
      untracked(refresh);
      const timer = setInterval(refresh, REFRESH_MILLISECONDS);
      onCleanup(() => clearInterval(timer));
    });
  }

  // The game must neither feel the panel's keys nor take the cursor over it for aiming.
  protected stopEvent(event: Event): void {
    event.stopPropagation();
  }

  // After a change or a press the focus goes back to the game, or its keys would go to the control and stop there.
  protected releaseFocus(event: Event): void {
    (event.target as HTMLElement).blur();
  }

  protected releaseFocusOnPress(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.closest('button, summary')) target.blur();
  }

  protected copy(): void {
    const state = this.gameService
      .readouts$$()
      .map(({ label, read }) => `${label} = ${read()}`)
      .join('\n');
    const text = `${this.tunables.report()}\n\n# State\n${state}`;
    this.report$$.set(text);
    afterNextRender(() => this.reportElem()?.nativeElement.select(), { injector: this.injector });
    navigator.clipboard?.writeText(text).catch(() => {}); // without the permission the box is still there
  }

  protected resetAll(): void {
    this.tunables.resetAll();
  }
}
