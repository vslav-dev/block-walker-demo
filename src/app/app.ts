import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DebugPanel } from '@app/components/debug-panel/debug-panel';
import { GameStatus } from '@app/components/game-status/game-status';
import { SettingsButton } from '@app/components/settings-button/settings-button';
import { SettingsScreen } from '@app/components/settings-screen/settings-screen';

// The game's screen: the page of the scene (the 3D view) with everything of the app laid over it. Later layers are drawn
// over earlier ones. The layers are the same on every scene and stay when the scene is changed.
@Component({
  selector: 'block-walker',
  templateUrl: './app.html',
  imports: [DebugPanel, GameStatus, RouterOutlet, SettingsButton, SettingsScreen],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
