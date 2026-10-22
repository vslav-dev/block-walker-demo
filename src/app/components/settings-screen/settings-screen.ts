import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameService } from '@app/services/game.service';
import { SettingsService } from '@app/services/settings.service';
import { SENSITIVITY_RANGE } from '@game/settings';

// The settings page over the game: it is open while the game stands still. A click beside the panel closes it, too.
@Component({
  selector: 'settings-screen',
  templateUrl: './settings-screen.html',
  styleUrl: './settings-screen.scss',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsScreen {
  protected readonly sensitivityRange = SENSITIVITY_RANGE;
  private readonly gameService = inject(GameService);
  private readonly settings = inject(SettingsService);

  protected readonly paused$$ = this.gameService.paused$$;
  protected readonly aimToggle$$ = this.settings.aimToggle$$;
  protected readonly mouseSensitivity$$ = this.settings.mouseSensitivity$$;

  protected setAimToggle(value: boolean): void {
    this.settings.setAimToggle(value);
  }

  protected setMouseSensitivity(value: number): void {
    this.settings.setMouseSensitivity(value);
  }

  protected close(): void {
    (document.activeElement as HTMLElement | null)?.blur(); // Space or Enter must not press the focused control again
    this.gameService.resume();
  }

  protected closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }
}
