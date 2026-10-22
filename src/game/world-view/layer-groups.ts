import { Block, Top, WALL_SIDES, frameOpening, frameSide, isStairs, STOREY_H } from '@game/world/blocks';
import type { World } from '@game/world/world';
import { blockType, topType, wallType, type LayerType } from './layer-types';
import { OPENING_PARTS } from './wall-parts';
import { wallPlaneKey, wallPlaneOf, type WallPlane } from './wall-plane';

// One instance of a layer: the cell and its rotation around the vertical axis.
export interface LayerCell {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

// The cells of one layer: the same type of block, building and storey (and, for a wall part, the same plane).
// Layers make "hide the roof when the player is inside" and "hide the building" plain visibility toggles,
// and a plane per layer makes "fade the walls between the camera and the player" one as well.
export interface LayerGroup {
  type: LayerType;
  plane: WallPlane | null; // the plane of a wall part, null for everything else
  building: number;
  storey: number;
  cells: LayerCell[];
}

// Blocks and walls belong to the storey whose floor plane is at their bottom; a top slab, to the storey above its plane.
const storeyOfBlock = (y: number): number => Math.max(0, Math.floor((y - 1) / STOREY_H));
const storeyOfTop = (y: number): number => Math.floor(y / STOREY_H);

// The walls of a storey, whole, are set in its lowest row, which is where this is true (see blocks.ts).
const isStoreyBase = (y: number): boolean => y >= 1 && (y - 1) % STOREY_H === 0;

// Sorts everything the world has to draw into layers.
export function collectLayerGroups(world: World): LayerGroup[] {
  const groups = new Map<string, LayerGroup>();

  const addInstances = (type: LayerType, storey: number, x: number, z: number, cells: LayerCell[], plane: WallPlane | null = null): void => {
    const building = world.buildingAt(x, z);
    const key = `${type}|${building}|${storey}|${plane ? wallPlaneKey(plane) : ''}`;
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { type, plane, building, storey, cells: [] }));
    group.cells.push(...cells);
  };

  for (let y = 0; y < world.sizeY; y++) {
    const storey = storeyOfBlock(y);
    for (let z = 0; z < world.sizeZ; z++) {
      for (let x = 0; x < world.sizeX; x++) {
        const id = world.get(x, y, z);
        if (isStairs(id)) addInstances(blockType(Block.Stairs), storey, x, z, [{ x, y, z, rotY: (-(id - Block.Stairs) * Math.PI) / 2 }]);
        else if (id !== Block.Air) addInstances(blockType(id), storey, x, z, [{ x, y, z, rotY: 0 }]);

        // A wall of the storey is one tall slab per side, except where there is an opening: its frame brings the wall around it.
        if (isStoreyBase(y)) {
          const frame = world.getFrame(x, y, z);
          const opened = frame ? frameSide(frame) : 0;
          for (const side of WALL_SIDES) {
            const cells = [{ x, y, z, rotY: side.rotY }];
            const plane = wallPlaneOf(side, x, z);
            if (opened & side.bit) for (const part of OPENING_PARTS[frameOpening(frame)]) addInstances(wallType(part), storey, x, z, cells, plane);
            else if (world.getWalls(x, y, z) & side.bit) addInstances(wallType('plain'), storey, x, z, cells, plane);
          }
        }

        const top = world.getTop(x, y, z);
        if (top !== Top.None) addInstances(topType(top), storeyOfTop(y), x, z, [{ x, y, z, rotY: 0 }]);
      }
    }
  }
  return [...groups.values()];
}
