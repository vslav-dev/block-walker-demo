import type { Segment } from './sight-segments';

// A hair's breadth of an angle: the rays that go just beside a corner, to see what is past it.
const BESIDE = 1e-4;
const PARALLEL = 1e-12;

// How far a ray from (ox, oz) along the unit direction (dx, dz) goes before it meets a segment, or `limit` if it meets none.
function rayLength(segments: readonly Segment[], ox: number, oz: number, dx: number, dz: number, limit: number): number {
  let nearest = limit;
  for (const { ax, az, bx, bz } of segments) {
    const ex = bx - ax;
    const ez = bz - az;
    const denominator = dx * ez - dz * ex;
    if (Math.abs(denominator) < PARALLEL) continue;
    const px = ax - ox;
    const pz = az - oz;
    const along = (px * ez - pz * ex) / denominator; // along the ray
    const across = (px * dz - pz * dx) / denominator; // along the segment, 0 at its start and 1 at its end
    if (along > 0 && along < nearest && across >= 0 && across <= 1) nearest = along;
  }
  return nearest;
}

// Where two segments cross, or null if they do not (or run side by side).
function crossing(a: Segment, b: Segment): [number, number] | null {
  const ex = a.bx - a.ax;
  const ez = a.bz - a.az;
  const fx = b.bx - b.ax;
  const fz = b.bz - b.az;
  const denominator = ex * fz - ez * fx;
  if (Math.abs(denominator) < PARALLEL) return null;
  const px = b.ax - a.ax;
  const pz = b.az - a.az;
  const along = (px * fz - pz * fx) / denominator; // along a
  const across = (px * ez - pz * ex) / denominator; // along b
  return along >= 0 && along <= 1 && across >= 0 && across <= 1 ? [a.ax + along * ex, a.az + along * ez] : null;
}

// Things that stop the sight, seen from above, and what is seen from a point among them.
//
// What is seen is a polygon round the point whose corners are where the rays from it stop. The boundary of it turns only at
// the corners of what stops the sight: at the end of a segment, and where two segments cross, since there the nearest one
// changes. So a ray goes to each of those points, and just beside it on both sides, and stops at the first segment it meets.
// A ray that is missing at a crossing would leave the polygon cutting the corner off, and the wall at it would be taken for hidden.
// What does not depend on the point (the corners of the segments) is found once, when the segments are given.
export class Occluders {
  private readonly corners: number[] = []; // [x0, z0, x1, z1, ...]: the ends of the segments and where they cross

  constructor(private readonly segments: readonly Segment[]) {
    segments.forEach((a, i) => {
      this.corners.push(a.ax, a.az, a.bx, a.bz);
      for (let j = i + 1; j < segments.length; j++) {
        const point = crossing(a, segments[j]);
        if (point) this.corners.push(...point);
      }
    });
  }

  // What is seen from (x, z), as the flat list [x0, z0, x1, z1, ...] of the corners of the polygon in the order of the angle
  // (from +x towards +z). Nothing is seen farther than `range`.
  polygonFrom(x: number, z: number, range: number): number[] {
    const frame: Segment[] = [
      { ax: x - range, az: z - range, bx: x + range, bz: z - range },
      { ax: x + range, az: z - range, bx: x + range, bz: z + range },
      { ax: x + range, az: z + range, bx: x - range, bz: z + range },
      { ax: x - range, az: z + range, bx: x - range, bz: z - range },
    ];
    const all = [...this.segments, ...frame];
    const angles: number[] = [];
    const aimAt = (px: number, pz: number): void => {
      const angle = Math.atan2(pz - z, px - x);
      angles.push(angle - BESIDE, angle, angle + BESIDE);
    };
    for (let i = 0; i < this.corners.length; i += 2) aimAt(this.corners[i], this.corners[i + 1]);
    for (const side of frame) {
      aimAt(side.ax, side.az);
      for (const segment of this.segments) {
        const point = crossing(side, segment);
        if (point) aimAt(...point);
      }
    }
    angles.sort((a, b) => a - b);

    const polygon: number[] = [];
    for (const angle of angles) {
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      const length = rayLength(all, x, z, dx, dz, 2 * range * Math.SQRT2);
      polygon.push(x + dx * length, z + dz * length);
    }
    return polygon;
  }
}

// What is seen from (x, z) among the segments, see Occluders.
export const visibilityPolygon = (segments: readonly Segment[], x: number, z: number, range: number): number[] => new Occluders(segments).polygonFrom(x, z, range);
