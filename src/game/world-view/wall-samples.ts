import { WALL_SIDES, WALL_THICKNESS } from '@game/world/blocks';
import type { LayerCell } from './layer-groups';
import type { WallPlane } from './wall-plane';

const ALONG = [0.1, 0.3, 0.5, 0.7, 0.9]; // along the cell, the share of its length
// Across the wall, from the border of the cells: a little way out on the side that the slab does not stand on, and on the side
// that it does, a little way past the slab. So a point of each face of the slab is close by, in what stands before that face.
const ACROSS_OUTSIDE = 0.06;
const ACROSS_INSIDE = WALL_THICKNESS + 0.06;

// The two faces of the wall of a cell. Each is the points just before it, as the flat list [x0, z0, x1, z1, ...]: by them it is told
// if the player sees the face. `low` is the face towards the smaller `axis` coordinates, `high` the one towards the greater;
// `middle` is the coordinate of the middle of the slab, so the camera sees `low` if it is before it, and `high` if beyond.
export interface WallFaces {
  axis: 'x' | 'z';
  middle: number;
  low: number[];
  high: number[];
}

// The faces of the wall of a cell. The wall is the slab on the side `cell.rotY` of the cell, in the plane `plane`.
export function wallFaces(plane: WallPlane, { x, z, rotY }: LayerCell): WallFaces {
  const side = WALL_SIDES.find((s) => s.rotY === rotY);
  if (!side) throw new Error(`No wall side is turned by ${rotY}`);
  const inward = -(side.dx + side.dz); // the slab stands in its cell: from the border, towards the cell
  const outside = -ACROSS_OUTSIDE * inward;
  const inside = ACROSS_INSIDE * inward;
  const pointsAt = (across: number) => {
    const points: number[] = [];
    for (const along of ALONG) points.push(...(plane.axis === 'x' ? [plane.at + across, z + along] : [x + along, plane.at + across]));
    return points;
  };
  const [low, high] = outside < inside ? [outside, inside] : [inside, outside];
  return { axis: plane.axis, middle: plane.at + (inward * WALL_THICKNESS) / 2, low: pointsAt(low), high: pointsAt(high) };
}
