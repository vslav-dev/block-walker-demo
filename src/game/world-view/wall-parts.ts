import { DOOR_H, FRAME_COLOR, FRAME_WIDTH, Opening, STOREY_H, WALL_COLOR, WALL_SKIN, WALL_THICKNESS, WINDOW_BOTTOM, WINDOW_TOP } from '@game/world/blocks';
import type { CellBox } from './cell-box';

// Mesh types of the slabs and frames, next to the block ids. A wall of a storey is one tall slab, or, with an opening, the
// wall around it and the frame in it. The walls between the camera and the player fade, so every plane of the walls of
// a storey is a layer of its own.

interface PartDef {
  color: number;
  boxes: CellBox[]; // on the north side of a cell: x across it, y up from the floor of the storey, z from its border into it
  castsShadow: boolean; // the wall stops the light; a frame is trim a hand wide, and its shadow on the wall is only a smear of the shadow map's texels
}

const FRAME_DEPTH = WALL_THICKNESS + 0.04; // a frame is a little deeper than the wall, so it stands out of it
const WALL_TOP = STOREY_H + WALL_SKIN;
const slab = (x0: number, y0: number, x1: number, y1: number): CellBox => ({ x0, y0, z0: -WALL_SKIN, x1, y1, z1: WALL_THICKNESS });
const bar = (x0: number, y0: number, x1: number, y1: number): CellBox => ({ x0, y0, z0: -WALL_SKIN, x1, y1, z1: FRAME_DEPTH }); // out to where the walls go, or the end of a wall that stands against it would show beside it
const DOOR_TOP = DOOR_H + FRAME_WIDTH; // the top of the header

// The boxes of every part on the north side of a cell. Nothing overlaps: the posts stand between the bars.
export const WALL_PARTS = {
  plain: { color: WALL_COLOR, boxes: [slab(0, 0, 1, WALL_TOP)], castsShadow: true },
  doorWall: { color: WALL_COLOR, boxes: [slab(0, DOOR_TOP, 1, WALL_TOP)], castsShadow: true },
  doorFrame: {
    color: FRAME_COLOR,
    boxes: [bar(0, 0, FRAME_WIDTH, DOOR_H), bar(1 - FRAME_WIDTH, 0, 1, DOOR_H), bar(0, DOOR_H, 1, DOOR_TOP)],
    castsShadow: false,
  },
  windowWall: { color: WALL_COLOR, boxes: [slab(0, 0, 1, WINDOW_BOTTOM), slab(0, WINDOW_TOP, 1, WALL_TOP)], castsShadow: true },
  windowFrame: {
    castsShadow: false,
    color: FRAME_COLOR,
    boxes: [
      bar(0, WINDOW_BOTTOM, 1, WINDOW_BOTTOM + FRAME_WIDTH), // sill
      bar(0, WINDOW_TOP - FRAME_WIDTH, 1, WINDOW_TOP), // header
      bar(0, WINDOW_BOTTOM + FRAME_WIDTH, FRAME_WIDTH, WINDOW_TOP - FRAME_WIDTH), // posts
      bar(1 - FRAME_WIDTH, WINDOW_BOTTOM + FRAME_WIDTH, 1, WINDOW_TOP - FRAME_WIDTH),
    ],
  },
} satisfies Record<string, PartDef>;

export type WallPart = keyof typeof WALL_PARTS;

// The parts that an opening is made of.
export const OPENING_PARTS: Record<number, readonly WallPart[]> = {
  [Opening.Door]: ['doorWall', 'doorFrame'],
  [Opening.Window]: ['windowWall', 'windowFrame'],
};
