import { generateDepot } from '@game/world/depot/depot-generator';
import { generateTown } from '@game/world/town/town-generator';
import type { World } from '@game/world/world';
import * as THREE from 'three';
import type { CellBox } from './cell-box';
import { boxesOf } from './layer-boxes';
import { collectLayerGroups } from './layer-groups';
import { LAYER_COLORS } from './layer-types';

// Two faces in one plane, facing the same way, overlapping and out in the open, flicker: the picture takes whichever the rounding
// of the depth prefers, and it changes with the slightest move of the camera. They show only where they differ in colour; of
// the same colour (the walls of one building, which meet in corners and in T-joints) they are the same picture either way.
// A face that is inside another box (the end of a wall, where the next wall stands on) is not seen at all.

const EPS = 1e-6;
const OUT = 1e-4; // how far from a face is "just outside" it
const SAMPLES = [0.25, 0.5, 0.75]; // across a shared patch, the share of its size

interface WorldBox {
  min: number[];
  max: number[];
  color: number;
}

// Every box of every layer of the world, where it stands in it.
function worldBoxes(world: World): WorldBox[] {
  const boxes: WorldBox[] = [];
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const bounds = new THREE.Box3();
  for (const { type, cells } of collectLayerGroups(world)) {
    for (const { x, y, z, rotY } of cells) {
      matrix.compose(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(1, 1, 1));
      for (const { x0, y0, z0, x1, y1, z1 } of boxesOf(type)) {
        bounds.set(new THREE.Vector3(x0 - 0.5, y0 - 0.5, z0 - 0.5), new THREE.Vector3(x1 - 0.5, y1 - 0.5, z1 - 0.5)).applyMatrix4(matrix);
        boxes.push({ min: bounds.min.toArray(), max: bounds.max.toArray(), color: LAYER_COLORS[type] });
      }
    }
  }
  return boxes;
}

// A patch of a plane that two boxes face the same way from: the axis across it, the way it faces (1 or -1), where it is, its extent.
interface Patch {
  axis: number;
  sign: 1 | -1;
  at: number;
  from: number[];
  to: number[];
}

// The faces that two boxes share in plane and facing, wherever they overlap.
function sharedPatches(a: Pick<WorldBox, 'min' | 'max'>, b: Pick<WorldBox, 'min' | 'max'>): Patch[] {
  const patches: Patch[] = [];
  const from = a.min.map((v, k) => Math.max(v, b.min[k]));
  const to = a.max.map((v, k) => Math.min(v, b.max[k]));
  for (let axis = 0; axis < 3; axis++) {
    if ([0, 1, 2].some((k) => k !== axis && to[k] - from[k] <= EPS)) continue;
    if (Math.abs(a.max[axis] - b.max[axis]) < EPS) patches.push({ axis, sign: 1, at: a.max[axis], from, to });
    if (Math.abs(a.min[axis] - b.min[axis]) < EPS) patches.push({ axis, sign: -1, at: a.min[axis], from, to });
  }
  return patches;
}

// The pairs of boxes of different colours with a face in common that is in the open somewhere. Boxes are looked at only against
// those in the cells they touch.
function flickering(boxes: readonly WorldBox[]): string[] {
  const grid = new Map<string, number[]>();
  const cellsOf = ({ min, max }: Pick<WorldBox, 'min' | 'max'>): string[] => {
    const keys: string[] = [];
    for (let z = Math.floor(min[2] + EPS); z <= Math.floor(max[2] - EPS); z++)
      for (let y = Math.floor(min[1] + EPS); y <= Math.floor(max[1] - EPS); y++)
        for (let x = Math.floor(min[0] + EPS); x <= Math.floor(max[0] - EPS); x++) keys.push(`${x}|${y}|${z}`);
    return keys;
  };
  boxes.forEach((box, i) => {
    for (const key of cellsOf(box)) grid.set(key, [...(grid.get(key) ?? []), i]);
  });
  const solidAt = (p: number[]): boolean =>
    (grid.get(p.map(Math.floor).join('|')) ?? []).some((i) => p.every((v, k) => v > boxes[i].min[k] && v < boxes[i].max[k]));
  const exposed = ({ axis, sign, at, from, to }: Patch): boolean =>
    SAMPLES.some((u) =>
      SAMPLES.some((v) => {
        const [s, t] = [0, 1, 2].filter((k) => k !== axis);
        const p: number[] = [];
        p[axis] = at + sign * OUT;
        p[s] = from[s] + (to[s] - from[s]) * u;
        p[t] = from[t] + (to[t] - from[t]) * v;
        return !solidAt(p);
      }),
    );

  const found = new Set<string>();
  for (const indices of grid.values()) {
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const [a, b] = [boxes[indices[i]], boxes[indices[j]]];
        if (a.color === b.color) continue;
        for (const patch of sharedPatches(a, b)) {
          if (exposed(patch)) found.add(`${a.color.toString(16)} and ${b.color.toString(16)}: ${patch.sign > 0 ? '+' : '-'}${'xyz'[patch.axis]} at ${patch.at.toFixed(3)} near ${patch.from.map((v) => v.toFixed(2))}`);
        }
      }
    }
  }
  return [...found];
}

describe('the boxes of the layers', () => {
  it('the check finds a floor whose edge is flush with a wall, and does not once the wall is a skin bigger: the flicker that it is made against', () => {
    const floor = { min: [-1, 3.9, 0], max: [2, 4, 1] };
    expect(sharedPatches({ min: [0, 3, 0], max: [1, 4, 0.1] }, floor).map(({ sign, axis }) => `${sign}${'xyz'[axis]}`).sort()).toEqual(['-1z', '1y']);
    expect(sharedPatches({ min: [0, 3, -0.01], max: [1, 4.01, 0.1] }, floor)).toEqual([]);
  });

  it('a face that is inside another box is not in the open, however it lies', () => {
    const [wall, floor, next] = [{ min: [0, 3, 0], max: [1, 4, 0.1], color: 1 }, { min: [0, 3.9, 0], max: [1, 4, 1], color: 2 }, { min: [1, 3, -1], max: [2, 4, 2], color: 3 }];
    expect(flickering([wall, floor]).length, 'alone, their ends and sides are in one plane').toBeGreaterThan(0);
    expect(flickering([wall, floor, next]).every((line) => !line.includes('+x')), 'the ends that the next box stands on are not').toBe(true);
  });

  it('no two layers of a different colour have faces in one plane, in the town or in the depot: floors, roofs, stairs and blocks against walls, frames against walls', () => {
    const worlds = [1, 2, 3, 7, 11].flatMap((seed) => [generateDepot(seed).world, generateTown(seed).world]);
    for (const world of worlds) expect(flickering(worldBoxes(world))).toEqual([]);
  });

  it('the boxes of a part do not overlap each other', () => {
    for (const type of Object.keys(LAYER_COLORS)) {
      const boxes: readonly CellBox[] = boxesOf(type);
      boxes.forEach((a, i) =>
        boxes.slice(i + 1).forEach((b) => {
          const overlap = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > EPS && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > EPS && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > EPS;
          expect(overlap, type).toBe(false);
        }),
      );
    }
  });
});
