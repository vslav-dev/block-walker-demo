import { Injectable, computed, inject, signal } from '@angular/core';
import { SettingsService } from '@app/services/settings.service';
import { TunablesService } from '@app/services/tunables.service';
import { Game } from '@game/game';
import { randomSeed, type SceneId } from '@game/world/generator';

const LOADING_STATUS = 'Loading…';
const FAILURE_STATUS_MILLISECONDS = 4000;

// Runs the game inside the app: creates it in a container and tears it down, gives it the settings and the tuned numbers,
// and tells the screens what is going on (what to say to the player, whether the game stands still).
@Injectable({
  providedIn: 'root',
})
export class GameService {
  private readonly settings = inject(SettingsService);
  private readonly tunables = inject(TunablesService);

  readonly game$$ = signal<Game | null>(null);
  readonly readouts$$ = computed(() => this.game$$()?.readouts ?? []);
  // The tunable numbers that matter in the game that is played: those of the sky are no use in the dark, and the other way round.
  readonly specs$$ = computed(() => {
    const biome = this.game$$()?.biome;
    return this.tunables.specs.filter((spec) => spec.shownIn === undefined || spec.shownIn === biome);
  });
  readonly status$$ = signal<string | null>(null);
  // The game stands still while the player is in the settings.
  readonly paused$$ = signal(false);

  // Plays the scene in the container, replacing the game that is played now. The seed is the one of the address
  // (text, as it comes from there); without a good one the world is a new one.
  initializeGame(container: HTMLElement, scene: SceneId, seedText?: string): void {
    this.destroyGame();
    const seed = Number(seedText) || randomSeed();
    const game = new Game(container, { scene, seed }, { settings: this.settings, tuning: this.tunables.values });
    if (this.paused$$()) game.pause();
    game.start();
    this.game$$.set(game);
    void this.loadCharacter(game);
  }

  destroyGame(): void {
    this.game$$()?.dispose();
    this.game$$.set(null);
  }

  pause(): void {
    this.paused$$.set(true);
    this.game$$()?.pause();
  }

  // Call it from a click or a key: the game takes back the pointer then.
  resume(): void {
    this.paused$$.set(false);
    this.game$$()?.resume();
  }

  // The game is played without the character until its model is loaded, or for good if it cannot be.
  private async loadCharacter(game: Game): Promise<void> {
    this.status$$.set(LOADING_STATUS);
    try {
      await game.loadCharacter();
      if (this.game$$() === game) this.status$$.set(null);
    } catch (error) {
      if (this.game$$() !== game) return;
      const status = `Failed to load the robot: ${error instanceof Error ? error.message : error}`;
      this.status$$.set(status);
      setTimeout(() => {
        if (this.status$$() === status) this.status$$.set(null);
      }, FAILURE_STATUS_MILLISECONDS);
    }
  }
}
