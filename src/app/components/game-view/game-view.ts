import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { GameService } from '@app/services/game.service';

// The place of the 3D view: the game puts its canvas here. R makes a new world.
@Component({
  selector: 'game-view',
  templateUrl: './game-view.html',
  styleUrl: './game-view.scss',
  host: {
    '(window:keydown)': 'onKeydown($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameView {
  private readonly containerElem = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly gameService = inject(GameService);

  constructor() {
    afterNextRender(() => {
      this.gameService.initializeGame(this.containerElem().nativeElement);
    });

    inject(DestroyRef).onDestroy(() => {
      this.gameService.destroyGame();
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const modified = event.ctrlKey || event.metaKey || event.altKey; // Ctrl+R and Cmd+R are the browser's
    if (event.code === 'KeyR' && !event.repeat && !modified && !this.gameService.paused$$()) this.gameService.newWorld();
  }
}
