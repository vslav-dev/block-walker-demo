// Which lights to switch on. Every light in the scene costs the picture something (a shadow map of its own and a place in
// every shader), so only a few shine at a time: those that matter most for the player.

interface Located {
  x: number;
  z: number;
}

// The `count` lights that matter most for the point (x, z), the most important first. A light matters the more the nearer the
// point is to its reach: how far the light still is from the point once its own reach is taken off. A far lamp that
// reaches the point comes before a near candle that does not.
export function nearestLights<T extends Located>(lights: readonly T[], x: number, z: number, count: number, reachOf: (light: T) => number): T[] {
  const gap = (light: T): number => Math.hypot(light.x - x, light.z - z) - reachOf(light);
  return lights
    .map((light) => ({ light, gap: gap(light) }))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, count)
    .map(({ light }) => light);
}
