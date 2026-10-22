const EPSILON = 1e-9;

// What is seen from a point, as a polygon round it (see Occluders.polygonFrom): is a point of the plane in it? The corners
// go in the order of the angle round the point, so the polygon is fanned into triangles (the point, a corner, the next one),
// and the triangle that a point is in is found by its angle, in a few steps.
export class SeenArea {
  private readonly angles: Float64Array;

  // x, z = the point it is seen from, corners = the flat list [x0, z0, x1, z1, ...] in the order of the angle from it.
  constructor(
    private readonly x: number,
    private readonly z: number,
    private readonly corners: readonly number[],
  ) {
    this.angles = new Float64Array(corners.length / 2);
    for (let i = 0; i < this.angles.length; i++) this.angles[i] = Math.atan2(corners[2 * i + 1] - z, corners[2 * i] - x);
  }

  contains(px: number, pz: number): boolean {
    const n = this.angles.length;
    const dx = px - this.x;
    const dz = pz - this.z;
    if (n === 0 || dx * dx + dz * dz < EPSILON) return true; // the point itself
    const angle = Math.atan2(dz, dx);
    let low = 0;
    let high = n;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (this.angles[middle] <= angle) low = middle + 1;
      else high = middle;
    }
    const from = (low - 1 + n) % n; // the corners on both sides of the angle (past the ends: the last and the first)
    const to = low % n;
    const ax = this.corners[2 * from] - this.x;
    const az = this.corners[2 * from + 1] - this.z;
    const ex = this.corners[2 * to] - this.x - ax; // the edge of the polygon, from one corner to the next
    const ez = this.corners[2 * to + 1] - this.z - az;
    // On the side of the edge where the point it is seen from is, or on it.
    const here = ex * (dz - az) - ez * (dx - ax);
    const origin = ex * -az - ez * -ax;
    return origin === 0 || here * origin >= -EPSILON;
  }
}
