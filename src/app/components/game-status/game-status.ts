import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameService } from '@app/services/game.service';

// What the player is told in the middle of the screen: that the game is loading, or what went wrong.
@Component({
  selector: 'game-status',
  templateUrl: './game-status.html',
  styleUrl: './game-status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameStatus {
  protected readonly status$$ = inject(GameService).status$$;
}
