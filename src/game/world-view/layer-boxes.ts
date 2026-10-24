import { Block, STAIR_STEPS, WALL_THICKNESS } from '@game/world/blocks';
import type { CellBox } from './cell-box';
import { blockType, isTopType, isWallType, wallPartOf, type LayerType } from './layer-types';
import { WALL_PARTS } from './wall-parts';

// What every layer is drawn as: its boxes in a cell. The meshes are made of these, and so is the check that no two layers have
// faces in one plane (see layer-boxes.spec.ts): the shapes are in this one place and nowhere else.

const CUBE: readonly CellBox[] = [{ x0: 0, y0: 0, z0: 0, x1: 1, y1: 1, z1: 1 }];

// One flight of steps in a block, rising towards +x.
const STAIRS: readonly CellBox[] = Array.from({ length: STAIR_STEPS }, (_, i) => ({
  x0: i / STAIR_STEPS,
  y0: 0,
  z0: 0,
  x1: (i + 1) / STAIR_STEPS,
  y1: (i + 1) / STAIR_STEPS,
  z1: 1,
}));

// The slab of a floor or roof: the top face of the cell.
const TOP: readonly CellBox[] = [{ x0: 0, y0: 1 - WALL_THICKNESS, z0: 0, x1: 1, y1: 1, z1: 1 }];

export function boxesOf(type: LayerType): readonly CellBox[] {
  if (isWallType(type)) return WALL_PARTS[wallPartOf(type)].boxes;
  if (isTopType(type)) return TOP;
  return type === blockType(Block.Stairs) ? STAIRS : CUBE;
}
