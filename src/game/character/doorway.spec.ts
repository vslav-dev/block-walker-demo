import { DT, SEEDS, wallWorld } from '@game/testing/worlds';
import { Opening, wallSideByBit, frameOpening, frameSide } from '@game/world/blocks';
import { generateDepot } from '@game/world/depot/depot-generator';
import { doorwaysNear } from './doorway';
import { PlayerBody, RUN_SPEED, WALK_SPEED, WALL_REACH } from './player-body';

// The wall is across x at x = 4 (its slab from 4 to 4.1), the doorway is z 6..7, its middle is 6.5.
const MIDDLE = 6.5;
const OFFSETS_LED = [-0.6, -0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45, 0.6]; // within CAPTURE

function walkFor(body: PlayerBody, vx: number, vz: number, seconds: number, dt = DT): void {
  for (let t = 0; t < seconds; t += dt) body.update(dt, vx, vz);
}

describe('doorways', () => {
  it('the doorways found are the doors of the frames, with the wall they are in and the middle of the opening', () => {
    expect(doorwaysNear(wallWorld(), 3.5, 1, 6.5)).toEqual([{ acrossX: true, plane: 4, center: MIDDLE }]);
    expect(doorwaysNear(wallWorld(), 3.5, 1, 1.5), 'not far from the body: none round it').toEqual([]);
  });

  it('a body that walks at the doorway straight goes through it, from anywhere in front of it, at any speed and from either side', () => {
    for (const [from, speed] of [[1.5, WALK_SPEED], [1.5, RUN_SPEED], [1.5, 1], [6.5, -WALK_SPEED], [6.5, -RUN_SPEED]]) {
      for (const offset of OFFSETS_LED) {
        const body = new PlayerBody(wallWorld(), from, MIDDLE + offset);
        walkFor(body, speed, 0, 4);
        expect(Math.sign(body.x - 4) * Math.sign(speed), `from x=${from} at ${speed}, off the middle by ${offset}: got x=${body.x}`).toBe(1);
        expect(Math.abs(body.x - 4), `through, not at the wall: x=${body.x}`).toBeGreaterThan(0.9);
      }
    }
  });

  it('long frames do not break it', () => {
    for (const offset of OFFSETS_LED) {
      const body = new PlayerBody(wallWorld(), 1.5, MIDDLE + offset);
      walkFor(body, RUN_SPEED, 0, 3, 0.05);
      expect(body.x, `off the middle by ${offset}: got x=${body.x}`).toBeGreaterThan(5);
    }
  });

  it('it works when the way is not straight: two keys at once, or a camera turned by any angle', () => {
    // The body goes at the doorway at an angle: along x at SPEED, and sideways by as much as the angle gives. It goes through
    // whatever the angle, as long as the sideways drift is less than the body is led by. It starts where the leading begins.
    for (const angle of [-0.5, -0.3, -0.15, 0, 0.15, 0.3, 0.5]) {
      for (const offset of [-0.4, -0.2, 0, 0.2, 0.4]) {
        const body = new PlayerBody(wallWorld(), 2.8, MIDDLE + offset);
        walkFor(body, WALK_SPEED * Math.cos(angle), WALK_SPEED * Math.sin(angle), 3);
        expect(body.x, `at ${angle} rad, off the middle by ${offset}: got x=${body.x}, z=${body.z}`).toBeGreaterThan(5);
      }
    }
  });

  it('it is the same distance whatever the speed: led by as much as walked, not as long as spent', () => {
    const at = (speed: number): number => {
      const body = new PlayerBody(wallWorld(), 2.5, MIDDLE + 0.6);
      while (body.x < 2.8) body.update(DT, speed, 0); // 0.3 walked at the doorway
      return body.z;
    };
    expect(at(1.5)).toBeCloseTo(at(RUN_SPEED), 1);
    expect(at(1.5), 'led towards the middle, and not all the way yet').toBeLessThan(MIDDLE + 0.6);
    expect(at(1.5)).toBeGreaterThan(MIDDLE);
  });

  it('it is gentle: the body is moved sideways by no more than it walks forward', () => {
    const body = new PlayerBody(wallWorld(), 2.5, MIDDLE + 0.6);
    for (let t = 0; t < 2; t += DT) {
      const [x, z] = [body.x, body.z];
      body.update(DT, WALK_SPEED, 0);
      expect(Math.abs(body.z - z), `at x=${x}`).toBeLessThanOrEqual(1.2 * Math.abs(body.x - x) + 0.06); // the sideways step is led by a bit more when the wall holds the body
    }
  });

  it('a body that is beside the doorway is not led: it stops at the wall, and may stand there behind the jamb', () => {
    for (const offset of [-0.9, -0.75, 0.75, 0.9]) {
      const body = new PlayerBody(wallWorld(), 1.5, MIDDLE + offset);
      walkFor(body, WALK_SPEED, 0, 3);
      expect(body.x, `stopped at the wall, got x=${body.x}`).toBeLessThanOrEqual(4 - WALL_REACH + 1e-6);
      expect(body.z, `not led, got z=${body.z}`).toBeCloseTo(MIDDLE + offset, 6);
    }
  });

  it('walking along the wall past the doorway, or standing by it, does not lead the body into it', () => {
    const along = new PlayerBody(wallWorld(), 3.5, 3.5);
    walkFor(along, 0, WALK_SPEED, 2.5); // z from 3.5 to 8: past the doorway
    expect(along.z, 'walked past').toBeGreaterThan(7.5);
    expect(along.x, 'and stayed where it was, a bit off the wall').toBe(3.5);

    const still = new PlayerBody(wallWorld(), 3.5, MIDDLE + 0.3);
    walkFor(still, 0, 0, 1);
    expect([still.x, still.z]).toEqual([3.5, MIDDLE + 0.3]);
  });

  it('it is the doors that lead the body: a gap without a door is no doorway', () => {
    const world = wallWorld();
    world.setFrame(4, 1, 6, 0);
    expect(doorwaysNear(world, 3.5, 1, 6.5)).toEqual([]);
  });

  it('every doorway of the depots is led through, from both sides, from anywhere in front of it that is off its middle by 0.5', () => {
    let tried = 0;
    for (const seed of SEEDS) {
      const { world } = generateDepot(seed);
      for (let cz = 0; cz < world.sizeZ; cz++) {
        for (let cx = 0; cx < world.sizeX; cx++) {
          const frame = world.getFrame(cx, 1, cz);
          if (frame === 0 || frameOpening(frame) !== Opening.Door) continue;
          const { dx, dz } = wallSideByBit(frameSide(frame));
          const acrossX = dx !== 0;
          const plane = acrossX ? cx + (dx > 0 ? 1 : 0) : cz + (dz > 0 ? 1 : 0);
          const middle = (acrossX ? cz : cx) + 0.5;
          for (const direction of [1, -1]) {
            for (const offset of [-0.5, 0.5]) {
              const start = { x: acrossX ? plane - 2 * direction : middle + offset, z: acrossX ? middle + offset : plane - 2 * direction };
              const body = new PlayerBody(world, start.x, start.z);
              if (!body.canStand(start.x, start.z)) continue;
              walkFor(body, acrossX ? direction * WALK_SPEED : 0, acrossX ? 0 : direction * WALK_SPEED, 4);
              const across = (acrossX ? body.x : body.z) - plane;
              expect(across * direction, `seed ${seed}: the doorway at (${cx}, ${cz}), ${direction}, ${offset}: got ${across}`).toBeGreaterThan(0.9);
              tried++;
            }
          }
        }
      }
    }
    expect(tried, 'the depots have doorways').toBeGreaterThan(20);
  });
});
