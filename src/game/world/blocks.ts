// Block ids, colors and shared physical constants. One block = 1 world unit.
// The ids are plain numbers (not a union): they are stored in typed arrays and stairs are Stairs + a direction.

export const Block = {
  Air: 0,
  Planks: 1,
  Rock: 2,
  Stairs: 3, // 3..6 = Stairs + direction (see StairDir)
};

// Stairs rise towards this direction. Index = id - Block.Stairs.
export const StairDir = [
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
  { x: 0, z: -1 },
];

export const BlockColor: Record<number, number> = {
  [Block.Planks]: 0xb8895a,
  [Block.Rock]: 0x8d8d95,
  [Block.Stairs]: 0x9c6f45,
};

export const isStairs = (id: number): boolean => id >= Block.Stairs;
export const isCube = (id: number): boolean => id !== Block.Air && !isStairs(id);

// Walls, floors and roofs are not blocks: they are thin slabs on the faces of the cells (see World.walls and World.tops).
// So a block can share its cell with them (stairs docked to a wall), and a house is as big inside as its footprint.
// Logically they have no thickness: a wall is a vertical plane on the border of a cell, a floor is a horizontal plane
// between two cells. They are only drawn (and felt by the body) as slabs this thick, kept inside the cell next to
// the plane, so the rest of the cell stays free.
export const WALL_THICKNESS = 0.1;
export const WALL_COLOR = 0xe3dccd;

// A floor is the top face of the cell below it: the slab of the cell y lies under the plane y + 1, so a character
// standing on the plane stands on the slab. The roof is the top slab of the highest storey.
export const Top = { None: 0, Grass: 1, Planks: 2, Roof: 3 };
export const TopColor: Record<number, number> = {
  [Top.Grass]: 0x6aa84f,
  [Top.Planks]: 0xb8895a,
  [Top.Roof]: 0xa8472f,
};

export const WallSide = { North: 1, South: 2, West: 4, East: 8 }; // north = -z, up the screen while the camera looks north

// A wall of a storey is drawn as one tall slab, STOREY_H blocks high. An opening (a door or a window) in it is a frame,
// see World.frames, set in the lowest row of the storey: the slab is replaced by the wall around the opening and the frame in it.
// The frame is drawn only, nothing is felt of it; what the body feels are the slabs in the rows of the cell (a doorway has
// none, a window keeps the lower row as a parapet). A frame is a number: the WallSide of its wall and the Opening.
export const Opening = { Door: 1, Window: 2 };
export const FRAME_WIDTH = 0.12;
export const FRAME_COLOR = 0x8a6a4a;
export const frameValue = (side: number, opening: number): number => (side << 2) | opening;
export const frameSide = (frame: number): number => frame >> 2;
export const frameOpening = (frame: number): number => frame & 3;

// A rectangle [x0, z0, x1, z1] in cell coordinates.
export type Rect = readonly [number, number, number, number];

export interface WallSideInfo {
  bit: number;
  dx: number;
  dz: number;
  rect: Rect;
  rotY: number;
}

// In WallSide order. dx/dz point from the cell center to the side, rect = the slab inside the cell.
export const WALL_SIDES: readonly WallSideInfo[] = [
  { bit: WallSide.North, dx: 0, dz: -1, rect: [0, 0, 1, WALL_THICKNESS] as Rect },
  { bit: WallSide.South, dx: 0, dz: 1, rect: [0, 1 - WALL_THICKNESS, 1, 1] as Rect },
  { bit: WallSide.West, dx: -1, dz: 0, rect: [0, 0, WALL_THICKNESS, 1] as Rect },
  { bit: WallSide.East, dx: 1, dz: 0, rect: [1 - WALL_THICKNESS, 0, 1, 1] as Rect },
].map((side) => ({ ...side, rotY: Math.atan2(-side.dx, -side.dz) })); // rotation of the north slab onto this side

// The side with this WallSide bit.
export function wallSideByBit(bit: number): WallSideInfo {
  const side = WALL_SIDES.find((s) => s.bit === bit);
  if (!side) throw new Error(`No wall side has the bit ${bit}`);
  return side;
}

// The side that faces the neighboring cell at (dx, dz) from the cell, one of the four orthogonal steps.
export function wallSideToward(dx: number, dz: number): WallSideInfo {
  const side = WALL_SIDES.find((s) => s.dx === dx && s.dz === dz);
  if (!side) throw new Error(`No wall side faces (${dx}, ${dz})`);
  return side;
}

// The sides, as a bit mask, that face a direction (a unit vector dx/dz): their outward normal points at least `minDot` that way.
export const sidesFacing = (dx: number, dz: number, minDot: number): number =>
  WALL_SIDES.reduce((mask, side) => (side.dx * dx + side.dz * dz > minDot ? mask | side.bit : mask), 0);

// Parts of a cell that block movement, as [x0, z0, x1, z1] in cell coordinates.
// Stairs are not listed: they are walkable by their surface height, see stairHeight.
export const CUBE_RECTS: readonly Rect[] = [[0, 0, 1, 1]];
export const WALL_RECTS: readonly (readonly Rect[])[] = Array.from({ length: 16 }, (_, sides) =>
  WALL_SIDES.filter((side) => (sides & side.bit) !== 0).map((side) => side.rect),
);

// Does the rectangle [x0, z0, x1, z1] (cell coordinates, may stick out of the cell) overlap any of the rects?
export const overlapsAny = (rects: readonly Rect[], x0: number, z0: number, x1: number, z1: number): boolean =>
  rects.some(([a, b, c, d]) => x0 < c && x1 > a && z0 < d && z1 > b);

// Floor to floor: the walls of a storey are this many blocks high, the floor planes lie at 1, 1 + STOREY_H, ...
// The stairs between two storeys are this many blocks long, one block per block of height.
export const STOREY_H = 2;

// Openings, heights from the floor of the storey. A doorway is clear up to DOOR_H, a header FRAME_WIDTH thick sits on it,
// and over the header there is a strip of wall of the same thickness: not a hole up to the ceiling. The strip is drawn only,
// the head (1.7) is under it. A window's frame stands between WINDOW_BOTTOM and WINDOW_TOP: higher than a block, its top level
// with the top of the door header, with wall left over it and under it.
export const DOOR_H = STOREY_H - 2 * FRAME_WIDTH;
export const WINDOW_BOTTOM = 0.7;
export const WINDOW_TOP = DOOR_H + FRAME_WIDTH;

// Where an opening is clear, as [from, to] heights from the floor of the storey: a doorway up to its header, a window between
// its sill and its header. A line of sight passes through it; around it and over it, in the frame and the wall, it does not.
export const OPENING_CLEAR: Record<number, readonly [number, number]> = {
  [Opening.Door]: [0, DOOR_H],
  [Opening.Window]: [WINDOW_BOTTOM + FRAME_WIDTH, WINDOW_TOP - FRAME_WIDTH],
};

// A character that climbs to within this many blocks of the next floor already sees what is on it,
// so the view switches to that storey then, not when the feet reach the floor.
const STOREY_REVEAL = 1;

// The storey a character with feet at height y is in, for the view: 0 on the ground floor.
export const storeyAt = (y: number): number => Math.floor((y - 1 + STOREY_REVEAL) / STOREY_H);

// Stairs have this many visual/walkable steps per block. A storey is only 2 blocks high, so the first step must be low:
// the head (1.7) on it still passes under the floor beside the stairs (its slab starts 0.1 below the plane).
export const STAIR_STEPS = 6;

// Height of the stairs surface inside a block, from 0 to 1. fx/fz = position inside the block.
export function stairHeight(id: number, fx: number, fz: number): number {
  const dir = StairDir[id - Block.Stairs];
  const along = dir.x !== 0 ? (dir.x > 0 ? fx : 1 - fx) : dir.z > 0 ? fz : 1 - fz;
  return Math.min(1, (Math.floor(along * STAIR_STEPS) + 1) / STAIR_STEPS);
}
