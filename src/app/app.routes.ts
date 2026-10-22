import { Routes } from '@angular/router';
import { GameView } from '@app/components/game-view/game-view';
import { SceneId } from '@game/world/generator';

// A page for every scene, at the address of its id: /town, /depot. The page is the game view, the route tells it the scene.
// Every other address, the empty one too, leads to the town (the query, ?seed=, is kept).
export const routes: Routes = [
  ...Object.values(SceneId).map((scene) => ({ path: scene, component: GameView, data: { scene } })),
  { path: '**', redirectTo: SceneId.Town },
];
