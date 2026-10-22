import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameService } from '@app/services/game.service';

// The gear in the corner: it opens the settings, and the game stands still until they are closed.
@Component({
  selector: 'settings-button',
  templateUrl: './settings-button.html',
  styleUrl: './settings-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsButton {
  private readonly gameService = inject(GameService);

  protected open(): void {
    this.gameService.pause();
    (document.activeElement as HTMLElement | null)?.blur(); // Space or Enter must not press the gear again
  }
}
