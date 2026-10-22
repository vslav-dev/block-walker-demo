import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { GameService } from '@app/services/game.service';
import { randomSeed, type SceneId } from '@game/world/generator';

// The page of a scene: the game puts its canvas here. The address says which scene and which world to play: the route gives
// the scene, `?seed=` the world. R makes a new world, by changing the seed in the address.
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
  public readonly sceneInput = input.required<SceneId>({ alias: 'scene' });
  public readonly seedInput = input<string | undefined>(undefined, { alias: 'seed' });

  private readonly containerElem = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly gameService = inject(GameService);
  private readonly router = inject(Router);

  constructor() {
    // The game is made again whenever the scene or the seed of the address changes.
    afterRenderEffect(() => {
      const container = this.containerElem().nativeElement;
      const scene = this.sceneInput();
      const seed = this.seedInput();
      untracked(() => this.gameService.initializeGame(container, scene, seed));
    });

    inject(DestroyRef).onDestroy(() => {
      this.gameService.destroyGame();
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const modified = event.ctrlKey || event.metaKey || event.altKey; // Ctrl+R and Cmd+R are the browser's
    if (event.code === 'KeyR' && !event.repeat && !modified && !this.gameService.paused$$()) this.newWorld();
  }

  private newWorld(): void {
    void this.router.navigate([], { queryParams: { seed: randomSeed() }, replaceUrl: true });
  }
}
