import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DebugPanel } from '@app/components/debug-panel/debug-panel';
import { GameStatus } from '@app/components/game-status/game-status';
import { GameView } from '@app/components/game-view/game-view';
import { SettingsButton } from '@app/components/settings-button/settings-button';
import { SettingsScreen } from '@app/components/settings-screen/settings-screen';

// The game's screen: the 3D view with everything of the app laid over it. Later layers are drawn over earlier ones.
@Component({
  selector: 'block-walker',
  templateUrl: './app.html',
  imports: [DebugPanel, GameStatus, GameView, SettingsButton, SettingsScreen],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
