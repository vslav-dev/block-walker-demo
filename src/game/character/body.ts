import { Block, StairDir } from '@game/world/blocks';
import type { World } from '@game/world/world';
import { doorwayPull } from './doorway';

export const RADIUS = 0.3; // half-size of the footprint against cubes, ceilings and the ground
// Against thin walls the footprint is wider: arms and tools reach this far, and a thin wall would show them on its other side.
// Cubes are thick enough to hide them. Stays below half of a doorway (1) and of the 0.9 wide free part of a wall cell.
// A doorway is 1 wide and the body 2 * WALL_REACH = 0.8 against walls, so the middle of the body has 0.2 to go through by: the body is led, see doorway.ts.
export const WALL_REACH = 0.4;
const GRAVITY = 30;
const SLIDE_MAX = 0.45; // how far to the side the way round an obstacle may be, for the body to be pushed there
const SLIDE_STEP = 0.05;
const STAIRS_FUNNEL = 2; // sideways units per unit walked along the stairs that pull the body to their middle

export const WALK_SPEED = 3;
export const RUN_SPEED = 5.5;

// Center + 4 corners of the character's footprint, where the ground must exist.
const SAMPLES = [
  [0, 0],
  [RADIUS, RADIUS],
  [RADIUS, -RADIUS],
  [-RADIUS, RADIUS],
  [-RADIUS, -RADIUS],
];

// Position and collision of a character (the player, a creature of the simulation) on the voxel world. Rendering is not its business.
export class Body {
  x: number;
  y: number;
  z: number;
  vy = 0;

  constructor(
    private readonly world: World,
    x: number,
    z: number,
  ) {
    const ground = world.groundAt(x, z, 1);
    if (ground === null) throw new Error(`There is no ground to stand on at (${x}, ${z})`);
    this.x = x;
    this.z = z;
    this.y = ground;
  }

  update(dt: number, vx: number, vz: number): void {
    const { x, z } = this;
    const dx = vx * dt;
    const dz = vz * dt;
    this.funnelThroughDoorways(dx, dz);
    const straight = (dx !== 0) !== (dz !== 0);
    if (straight && !this.canStand(x + dx, z + dz)) this.slideAround(dx, dz);
    else this.move(dx, dz);
    this.funnelOnStairs(Math.abs(this.x - x), Math.abs(this.z - z));
    this.fall(dt);
  }

  // Every pose of the body must be one that fits: a move is accepted only if the body fits at the height it ends up at
  // (fall() lifts it onto stairs), and falling stops while the next height would not fit. Otherwise the body could end up
  // inside the stairs or under a ceiling with every way out blocked.
  canStand(x: number, z: number): boolean {
    const ground = this.world.groundAt(x, z, this.y);
    return ground !== null && this.fits(x, z, Math.max(this.y, ground));
  }

  fits(x: number, z: number, y: number): boolean {
    return (
      SAMPLES.every(([ox, oz]) => this.world.groundAt(x + ox, z + oz, y) !== null) && this.world.isClear(x, z, y, RADIUS, WALL_REACH)
    );
  }

  // Walking straight into the edge of an obstacle does not stop the body when the way round is near: it is pushed
  // sideways to the nearest side where the step fits, as fast as it walks. Walking into the middle of an obstacle
  // finds no such side within SLIDE_MAX and stops as before. dx/dz = the blocked step, one of them is 0.
  private slideAround(dx: number, dz: number): void {
    const alongX = dx !== 0;
    const step = Math.hypot(dx, dz);
    for (let offset = SLIDE_STEP; offset <= SLIDE_MAX; offset += SLIDE_STEP) {
      for (const side of [1, -1]) {
        const sx = alongX ? 0 : side * offset;
        const sz = alongX ? side * offset : 0;
        if (!this.canStand(this.x + dx + sx, this.z + dz + sz)) continue;
        const push = side * Math.min(offset, step);
        this.move(alongX ? 0 : push, alongX ? push : 0);
        return;
      }
    }
  }

  // Walking at a doorway leads the body to the middle of it, in any direction and at any speed, before the step is taken, so
  // that the step fits: it goes through without ever feeling the jambs, and it is not led by walking along the wall
  // or standing. dx/dz = the step the body means to take.
  private funnelThroughDoorways(dx: number, dz: number): void {
    const pull = doorwayPull(this.world, this.x, this.y, this.z, dx, dz);
    if (pull.x !== 0 || pull.z !== 0) this.move(pull.x, pull.z);
  }

  // Walking along stairs pulls the body to their middle, so it never climbs beside the stairwell and hits the ceiling.
  // Walking sideways does not, so the stairs can still be left. dx/dz = how far the body just moved.
  private funnelOnStairs(dx: number, dz: number): void {
    const id = this.world.stairsAt(this.x, this.z, this.y);
    if (id === Block.Air) return;
    const alongX = StairDir[id - Block.Stairs].x !== 0;
    const pull = (alongX ? dx : dz) * STAIRS_FUNNEL;
    const offset = alongX ? Math.floor(this.z) + 0.5 - this.z : Math.floor(this.x) + 0.5 - this.x;
    const step = Math.max(-pull, Math.min(pull, offset));
    if (alongX) this.move(0, step);
    else this.move(step, 0);
  }

  // Axes are resolved separately so the player slides along walls.
  private move(dx: number, dz: number): void {
    if (this.canStand(this.x + dx, this.z)) this.x += dx;
    if (this.canStand(this.x, this.z + dz)) this.z += dz;
  }

  private fall(dt: number): void {
    const ground = this.world.groundAt(this.x, this.z, this.y);
    if (ground === null) return;
    if (this.y > ground) {
      this.vy -= GRAVITY * dt;
      const next = Math.max(ground, this.y + this.vy * dt);
      if (this.fits(this.x, this.z, next)) this.y = next;
      if (this.y === ground || this.y !== next) this.vy = 0; // landed, or held up by something under the footprint
    } else {
      this.y = ground;
      this.vy = 0;
    }
  }
}
