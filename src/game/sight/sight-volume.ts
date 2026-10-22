// The triangles of a closed prism over a polygon, standing from `bottom` to `top`: a lid, a base and a side over every edge of
// the polygon. They are written into `positions` (x, y, z of every corner of every triangle, one after the other), and the
// number of corners written is returned. All the faces look outwards: the corners go the way that three.js takes as the front.
//
// The polygon is what is seen from the point (x, z): its corners go in the order of the angle round it, so the triangles
// (point, corner, next corner) tile it with no overlaps. `corners` is the flat list [x0, z0, x1, z1, ...].
export const VOLUME_CORNERS_PER_POINT = 12; // 3 of the lid, 3 of the base, 6 of the side

export function writeSightVolume(positions: Float32Array, corners: readonly number[], x: number, z: number, bottom: number, top: number): number {
  const count = corners.length / 2;
  let n = 0;
  const put = (px: number, py: number, pz: number): void => {
    positions[n++] = px;
    positions[n++] = py;
    positions[n++] = pz;
  };
  for (let i = 0; i < count; i++) {
    const [px, pz] = [corners[2 * i], corners[2 * i + 1]];
    const [qx, qz] = [corners[(2 * i + 2) % corners.length], corners[(2 * i + 3) % corners.length]];
    put(x, top, z); // the lid looks up
    put(qx, top, qz);
    put(px, top, pz);
    put(x, bottom, z); // the base looks down
    put(px, bottom, pz);
    put(qx, bottom, qz);
    put(px, bottom, pz); // the side looks out, two triangles
    put(qx, top, qz);
    put(qx, bottom, qz);
    put(px, bottom, pz);
    put(px, top, pz);
    put(qx, top, qz);
  }
  return n / 3;
}
