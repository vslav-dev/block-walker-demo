import { BlockColor, TopColor } from '@game/world/blocks';
import { WALL_PARTS, type WallPart } from './wall-parts';

// What a layer of the view is made of: a block, a part of a wall, or a floor or roof slab.
export type LayerType = string;

export const blockType = (id: number): LayerType => `block-${id}`;
export const wallType = (part: WallPart): LayerType => `wall-${part}`;
export const topType = (kind: number): LayerType => `top-${kind}`; // floors and roofs, one type per Top kind
export const isWallType = (type: LayerType): boolean => type.startsWith('wall-');
export const isTopType = (type: LayerType): boolean => type.startsWith('top-');

export const LAYER_COLORS: Record<LayerType, number> = {
  ...Object.fromEntries(Object.entries(BlockColor).map(([id, color]) => [blockType(Number(id)), color])),
  ...Object.fromEntries(Object.entries(WALL_PARTS).map(([part, { color }]) => [wallType(part as WallPart), color])),
  ...Object.fromEntries(Object.entries(TopColor).map(([kind, color]) => [topType(Number(kind)), color])),
};
