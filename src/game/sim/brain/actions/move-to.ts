import { ActionStatus, type Action } from '@game/sim/brain/action';
import type { Creature } from '@game/sim/creature';
import { StatId } from '@game/sim/stats';

const STUCK_CHECK_SECONDS = 1.5; // how often progress is looked at
const STUCK_PROGRESS = 0.5; // blocks: less than this over a check, and the way is blocked (a walk covers about four)

// Walks in a straight line to a point and is done when it is within `reach` of it. The body slides along what it meets, but
// there is no search for a way round: where a straight line does not lead, the walk fails as stuck and the plan is made again.
export class MoveTo implements Action {
  readonly label = 'Walking';
  readonly interruptible = true;
  failure?: string;
  private sinceCheck = 0;
  private checkedAt: { x: number; z: number } | null = null;

  constructor(
    private readonly x: number,
    private readonly z: number,
    private readonly reach: number,
  ) {}

  update(self: Creature, _sim: unknown, dt: number): ActionStatus {
    const { body } = self;
    const dx = this.x - body.x;
    const dz = this.z - body.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= this.reach) return ActionStatus.Done;
    if (this.isStuck(self, dt)) {
      this.failure = 'stuck';
      return ActionStatus.Failed;
    }
    const speed = Math.min(self.stats[StatId.WalkSpeed], distance / dt); // not past the point in one step
    self.velocity.x = (dx / distance) * speed;
    self.velocity.z = (dz / distance) * speed;
    return ActionStatus.Running;
  }

  private isStuck(self: Creature, dt: number): boolean {
    const { x, z } = self.body;
    this.checkedAt ??= { x, z };
    this.sinceCheck += dt;
    if (this.sinceCheck < STUCK_CHECK_SECONDS) return false;
    const moved = Math.hypot(x - this.checkedAt.x, z - this.checkedAt.z);
    this.sinceCheck = 0;
    this.checkedAt = { x, z };
    return moved < STUCK_PROGRESS;
  }
}
