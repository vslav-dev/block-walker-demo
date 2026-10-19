import { Block, CUBE_RECTS, Top, WALL_RECTS, WALL_THICKNESS, isCube, isStairs, overlapsAny, stairHeight } from './blocks.js';

export const STEP_UP = 0.55; // max height a character climbs without jumping
export const BODY_H = 1.7; // character height used for collisions

// Voxel grid + collision queries. Blocks are stored in a flat array, x fastest, then z, then y.
export class World {
  constructor(sizeX, sizeY, sizeZ) {
    this.sizeX = sizeX;
    this.sizeY = sizeY;
    this.sizeZ = sizeZ;
    this.blocks = new Uint8Array(sizeX * sizeY * sizeZ);
    // Wall slabs per cell, laid out like blocks: a bit mask of WallSide.
    this.walls = new Uint8Array(sizeX * sizeY * sizeZ);
    // The floor (or roof) slab on the top face of a cell, laid out like blocks: a Top kind.
    this.tops = new Uint8Array(sizeX * sizeY * sizeZ);
    // The frame of a door or a window in a cell, laid out like blocks: a number, see frameValue. Only drawn.
    this.frames = new Uint8Array(sizeX * sizeY * sizeZ);
    // Building id per (x, z) column, 0 = open air. Used to hide roofs when the player is inside.
    this.buildings = new Uint8Array(sizeX * sizeZ);
    // The entrance of every building: its wall cell and the WallSide of the wall it is in. { building, x, z, side }
    this.doors = [];
  }

  inBounds(x, y, z) {
    return x >= 0 && x < this.sizeX && y >= 0 && y < this.sizeY && z >= 0 && z < this.sizeZ;
  }

  index(x, y, z) {
    return x + z * this.sizeX + y * this.sizeX * this.sizeZ;
  }

  get(x, y, z) {
    return this.inBounds(x, y, z) ? this.blocks[this.index(x, y, z)] : Block.Air;
  }

  set(x, y, z, id) {
    this.blocks[this.index(x, y, z)] = id;
  }

  getWalls(x, y, z) {
    return this.inBounds(x, y, z) ? this.walls[this.index(x, y, z)] : 0;
  }

  addWalls(x, y, z, sides) {
    this.walls[this.index(x, y, z)] |= sides;
  }

  removeWalls(x, y, z, sides) {
    this.walls[this.index(x, y, z)] &= ~sides;
  }

  getFrame(x, y, z) {
    return this.inBounds(x, y, z) ? this.frames[this.index(x, y, z)] : 0;
  }

  setFrame(x, y, z, frame) {
    this.frames[this.index(x, y, z)] = frame;
  }

  getTop(x, y, z) {
    return this.inBounds(x, y, z) ? this.tops[this.index(x, y, z)] : Top.None;
  }

  setTop(x, y, z, kind) {
    this.tops[this.index(x, y, z)] = kind;
  }

  buildingAt(x, z) {
    return this.inBounds(x, 0, z) ? this.buildings[x + z * this.sizeX] : 0;
  }

  setBuilding(x, z, id) {
    this.buildings[x + z * this.sizeX] = id;
  }

  // Surface height a character at (x, z) with feet at y can stand on, or null if there is none.
  // Cubes are ground by their top, floors by their plane, stairs by their surface. A cube or a stairs surface higher
  // than STEP_UP is no ground; a floor that high is not ground either, but it is no obstacle here: it is a ceiling.
  groundAt(x, z, y) {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (!this.inBounds(cx, 0, cz)) return null;

    const ceil = y + STEP_UP;
    const top = Math.floor(ceil);
    for (let j = top; j >= 0; j--) {
      const id = this.get(cx, j, cz);
      if (isCube(id)) return j === top ? null : j + 1;
      if (isStairs(id)) {
        const surface = j + stairHeight(id, x - cx, z - cz);
        return surface <= ceil ? surface : null;
      }
      if (j < top && this.getTop(cx, j, cz) !== Top.None) return j + 1;
    }
    return null;
  }

  // The stairs block a character at (x, z) with feet at y stands on, or Block.Air.
  stairsAt(x, z, y) {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    for (let j = Math.floor(y + STEP_UP); j >= 0; j--) {
      const id = this.get(cx, j, cz);
      if (isStairs(id)) return id;
      if (isCube(id)) break;
    }
    return Block.Air;
  }

  // Can a character with feet at y fit around (x, z)? Cubes, floors and wall slabs from STEP_UP above the feet up to the head
  // block it, so a thin wall is felt however the square is placed. Cubes and floors are met by a square of half-size r,
  // wall slabs by the wider wallReach: arms stick out further than the body, and a thin wall would show them on its other side.
  // A floor above the character is a slab just under its plane, felt by the head only when the head gets there.
  isClear(x, z, y, r, wallReach = r) {
    const top = Math.floor(y + STEP_UP);
    const head = Math.floor(y + BODY_H);
    const reach = Math.max(r, wallReach);
    const hits = (rects, cx, cz, half) => overlapsAny(rects, x - half - cx, z - half - cz, x + half - cx, z + half - cz);
    for (let cz = Math.floor(z - reach); cz <= Math.floor(z + reach); cz++) {
      for (let cx = Math.floor(x - reach); cx <= Math.floor(x + reach); cx++) {
        for (let j = top; j <= head; j++) {
          const blocks = isCube(this.get(cx, j, cz)) || (this.getTop(cx, j, cz) !== Top.None && j + 1 - WALL_THICKNESS < y + BODY_H);
          if (blocks && hits(CUBE_RECTS, cx, cz, r)) return false;
          if (hits(WALL_RECTS[this.getWalls(cx, j, cz)], cx, cz, wallReach)) return false;
        }
      }
    }
    return true;
  }
}
