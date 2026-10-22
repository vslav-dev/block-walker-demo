// Is the point inside the polygon, given as the flat list of its corners [x0, z0, x1, z1, ...]? For the tests.
export function polygonContains(corners: readonly number[], x: number, z: number): boolean {
  let inside = false;
  const n = corners.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, zi, xj, zj] = [corners[2 * i], corners[2 * i + 1], corners[2 * j], corners[2 * j + 1]];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
