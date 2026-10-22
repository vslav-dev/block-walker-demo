import { generateDepot } from '@game/world/depot/depot-generator';
import { generateTown } from '@game/world/town/town-generator';
import type { GeneratedWorld } from '@game/world/world';

// The scenes of the game. A scene is only a way to make a world: the game, the camera, the light, the body and the view
// are the same in all of them. The id of a scene is the address of its page.
export const SceneId = {
  Town: 'town', // an open plain with houses of one and two storeys
  Depot: 'depot', // the inside of one big building, divided into rooms
} as const;

export type SceneId = (typeof SceneId)[keyof typeof SceneId];

// A new scene is a new line here (and in SceneId): its page is made from the list.
const GENERATORS: Record<SceneId, (seed: number) => GeneratedWorld> = {
  [SceneId.Town]: generateTown,
  [SceneId.Depot]: generateDepot,
};

const SEED_RANGE = 1e6;

export const randomSeed = (): number => Math.floor(Math.random() * SEED_RANGE);

// The world of a scene: the same seed gives the same world.
export function generateWorld(scene: SceneId, seed: number): GeneratedWorld {
  return GENERATORS[scene](seed);
}
