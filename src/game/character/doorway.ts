import { Opening, STOREY_H, frameOpening, frameSide, wallSideByBit } from '@game/world/blocks';
import type { World } from '@game/world/world';

// A doorway as the body meets it: the wall it is in is a plane across one axis, the opening is a stretch of it.
export interface Doorway {
  acrossX: boolean; // the wall is across x (it runs along z), so the way through is along x; else the other way
  plane: number; // where the wall is, along the way through
  center: number; // the middle of the opening, across the way through
}

// A body that walks at a doorway is led to the middle of it, so that it goes through however it walks. The body is 0.8 wide
// against walls and the doorway 1, so by itself it gets through only if it is within 0.1 of the middle.
// The body is led when it is a little off the middle, and not when it is beside the doorway (by more than CAPTURE): then
// it stops at the wall as it should, and one can stand against the wall by the doorway, behind its jamb.
const CAPTURE = 0.65; // how far across from the middle of the doorway the body may be and still be led
const LENGTH = 1.3; // how near to the wall, along the way through, the body begins to be led
const EXIT = 0.55; // how far past the wall it is led still: until the body, which is wider than the wall is thick, has cleared it
const FUNNEL = 1.2; // sideways units per unit walked at the wall: the same distance whatever the speed, and gentle enough not to be noticed

// The doorways (the frames of doors) of the storey of the body, in the cells round it.
export function doorwaysNear(world: World, x: number, y: number, z: number): Doorway[] {
  const floor = 1 + Math.floor((y - 0.5) / STOREY_H) * STOREY_H; // the lowest row of the storey: where the frames are
  const doorways: Doorway[] = [];
  for (let cz = Math.floor(z) - 2; cz <= Math.floor(z) + 2; cz++) {
    for (let cx = Math.floor(x) - 2; cx <= Math.floor(x) + 2; cx++) {
      const frame = world.getFrame(cx, floor, cz);
      if (frame === 0 || frameOpening(frame) !== Opening.Door) continue;
      const { dx, dz } = wallSideByBit(frameSide(frame));
      doorways.push(
        dx !== 0
          ? { acrossX: true, plane: cx + (dx > 0 ? 1 : 0), center: cz + 0.5 }
          : { acrossX: false, plane: cz + (dz > 0 ? 1 : 0), center: cx + 0.5 },
      );
    }
  }
  return doorways;
}

// The step sideways that leads a body at (x, z) towards the middle of the doorway that it walks at, when its next step is
// (dx, dz): the one it means to take, taken or not, so that a body that is held by a jamb is led just the same.
// The body is led by as much as it walks at the wall, never past the middle, and by the nearest doorway to its middle.
// Returns the step as {x, z}, one of them 0.
export function doorwayPull(world: World, x: number, y: number, z: number, dx: number, dz: number): { x: number; z: number } {
  let pull = { x: 0, z: 0 };
  let nearest = Infinity;
  for (const { acrossX, plane, center } of doorwaysNear(world, x, y, z)) {
    const through = acrossX ? dx : dz; // the step along the way through
    if (through === 0) continue;
    const before = Math.sign(through) * (plane - (acrossX ? x : z)); // how far the wall is ahead, below 0 once past it
    const offset = center - (acrossX ? z : x);
    if (before > LENGTH || before < -EXIT || Math.abs(offset) > CAPTURE || Math.abs(offset) >= nearest) continue;
    nearest = Math.abs(offset);
    const step = Math.max(-FUNNEL * Math.abs(through), Math.min(FUNNEL * Math.abs(through), offset));
    pull = acrossX ? { x: 0, z: step } : { x: step, z: 0 };
  }
  return pull;
}
