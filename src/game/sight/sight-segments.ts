import { WALL_SIDES, isCube } from '@game/world/blocks';
import type { World } from '@game/world/world';

// A stretch of something that stops a line of sight, seen from above: from (ax, az) to (bx, bz).
export interface Segment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

// A wall is a slab 0.1 thick that stands inside its cell, against the border. The sight stops a little inside the slab, not
// on the border: the face of the slab that the player sees is then on his side of the line whichever side of the border
// the slab is on, and the face on the other side of the slab is on the other.
const SIGHT_DEPTH = 0.03;
// The ends of the stretches reach a little past the wall, so that where two walls meet (their lines are shifted by the same
// depth) there is no gap between them to see through.
const OVERLAP = 0.06;

// A line of cell borders that stops the sight on one side of the slab, in cells.
interface Line {
  alongX: boolean; // the line runs along x (at a z), else along z (at an x)
  at: number; // where it is across, in the plane of the border
  inward: number; // +1 or -1: which way the slab stands from the border
  starts: number[]; // the cells it runs over, from where each unit stretch starts
}

// What stops a line of sight at the height of the middle of a row of cells, as segments: the walls whose slab is in the way
// there (a doorway, or a window that is clear there, lets it through, see World.sideStopsRay) and the cubes. Nothing else does.
// The eyes are in the middle of the upper row of a storey, 1.5 above its floor.
// The unit stretches of the walls that run on in a line are joined into one, so there are few segments.
export function sightSegments(world: World, row: number): Segment[] {
  const y = row + 0.5;
  const lines = new Map<string, Line>();
  const add = (alongX: boolean, at: number, inward: number, start: number): void => {
    const key = `${alongX}|${at}|${inward}`;
    let line = lines.get(key);
    if (!line) lines.set(key, (line = { alongX, at, inward, starts: [] }));
    line.starts.push(start);
  };

  for (let z = 0; z < world.sizeZ; z++) {
    for (let x = 0; x < world.sizeX; x++) {
      if (isCube(world.get(x, row, z))) {
        for (const { dx, dz } of WALL_SIDES) {
          if (!isCube(world.get(x + dx, row, z + dz))) add(dx === 0, dx === 0 ? z + (dz > 0 ? 1 : 0) : x + (dx > 0 ? 1 : 0), 0, dx === 0 ? x : z);
        }
      }
      const walls = world.getWalls(x, row, z);
      if (walls === 0) continue;
      for (const { bit, dx, dz } of WALL_SIDES) {
        if ((walls & bit) === 0 || !world.sideStopsRay(x, z, bit, y)) continue;
        const inward = -(dx + dz); // the slab stands in its cell: from the west border east, from the east border west, and so on
        add(dx === 0, dx === 0 ? z + (dz > 0 ? 1 : 0) : x + (dx > 0 ? 1 : 0), inward, dx === 0 ? x : z);
      }
    }
  }

  const segments: Segment[] = [];
  for (const { alongX, at, inward, starts } of lines.values()) {
    const across = at + inward * SIGHT_DEPTH;
    starts.sort((a, b) => a - b);
    let from = starts[0];
    let to = from + 1;
    const close = (): void => {
      const [a, b] = [from - OVERLAP, to + OVERLAP];
      segments.push(alongX ? { ax: a, az: across, bx: b, bz: across } : { ax: across, az: a, bx: across, bz: b });
    };
    for (const start of starts.slice(1)) {
      if (start === to) {
        to++;
        continue;
      }
      close();
      from = start;
      to = start + 1;
    }
    close();
  }
  return segments;
}
