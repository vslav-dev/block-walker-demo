import type { WallSideInfo } from '@game/world/blocks';

// The plane of a wall: the line x = at or z = at, on the border of cells. The walls on the two sides of the same border,
// the east side of one cell and the west side of the next, are in the same plane. It does not matter on which of them a wall
// was set: what a wall is to the player is where the player is in relation to its plane, not to the cell that holds it.
export interface WallPlane {
  axis: 'x' | 'z';
  at: number;
}

// The plane of the wall on this side of the cell (x, z).
export function wallPlaneOf(side: WallSideInfo, x: number, z: number): WallPlane {
  const alongX = side.dx !== 0;
  return { axis: alongX ? 'x' : 'z', at: (alongX ? x : z) + (side.dx + side.dz > 0 ? 1 : 0) };
}

export const wallPlaneKey = ({ axis, at }: WallPlane): string => `${axis}${at}`;

// Is the plane between the two points, one on each side of it? A wall in a plane that is between the camera and the player
// is in the way of the view; a wall in any other plane is not, whichever way it faces.
export function separates({ axis, at }: WallPlane, ax: number, az: number, bx: number, bz: number): boolean {
  return axis === 'x' ? (ax - at) * (bx - at) < 0 : (az - at) * (bz - at) < 0;
}
