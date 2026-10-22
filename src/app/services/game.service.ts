import { Injectable, computed, inject, signal } from '@angular/core';
import { SettingsService } from '@app/services/settings.service';
import { TunablesService } from '@app/services/tunables.service';
import { Game } from '@game/game';

const SEED_PARAM = 'seed';
const SEED_RANGE = 1e6;
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
  private container: HTMLElement | null = null;

  readonly game$$ = signal<Game | null>(null);
  readonly readouts$$ = computed(() => this.game$$()?.readouts ?? []);
  readonly status$$ = signal<string | null>(null);
  // The game stands still while the player is in the settings.
  readonly paused$$ = signal(false);

  // The world of the seed in the address, or of a new one.
  initializeGame(container: HTMLElement): void {
    this.container = container;
    this.startGame(container, Number(new URLSearchParams(location.search).get(SEED_PARAM)) || this.randomSeed());
  }

  // A new world, and its seed in the address.
  newWorld(): void {
    if (!this.container) return;
    const seed = this.randomSeed();
    history.replaceState(null, '', `?${SEED_PARAM}=${seed}`);
    this.startGame(this.container, seed);
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

  private startGame(container: HTMLElement, seed: number): void {
    this.destroyGame();
    const game = new Game(container, seed, { settings: this.settings, tuning: this.tunables.values });
    if (this.paused$$()) game.pause();
    game.start();
    this.game$$.set(game);
    void this.loadCharacter(game);
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

  private randomSeed(): number {
    return Math.floor(Math.random() * SEED_RANGE);
  }
}
