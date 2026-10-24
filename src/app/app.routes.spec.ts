import { SceneId } from '@game/world/generator';
import { routes } from './app.routes';

describe('routes', () => {
  it('every scene has a page at the address of its id, and the page is told the scene', () => {
    for (const scene of Object.values(SceneId)) {
      const route = routes.find((r) => r.path === scene);
      expect(route, scene).toBeDefined();
      expect(route?.data, scene).toEqual({ scene });
    }
  });

  it('any other address leads to the plainfield', () => {
    expect(routes.find((r) => r.path === '**')?.redirectTo).toBe(SceneId.Plainfield);
  });
});
