import type { Robot } from '@game/character/robot';
import { STAIRS_SMOOTHING_SPEED } from '@game/config';
import type { Creature } from '@game/sim/creature';
import { CreatureLabel } from '@game/sim-view/creature-label';

const MOVING_BELOW = 1e-4; // blocks in a frame: a creature that has moved less than this is standing

// A creature on the screen: a robot where its body is, walking when the body has moved, and a label over its head. The creature
// is the master: the view only follows it and never decides anything.
export class CreatureView {
  private readonly label = new CreatureLabel();
  private visualY: number; // the height the creature is drawn at
  private lastX: number;
  private lastZ: number;

  constructor(
    private readonly creature: Creature,
    private readonly robot: Robot,
  ) {
    robot.root.add(this.label.sprite);
    this.visualY = creature.body.y;
    this.lastX = creature.body.x;
    this.lastZ = creature.body.z;
  }

  update(dt: number, showLabel: boolean): void {
    const { body, heading, brain, kind } = this.creature;
    this.visualY += (body.y - this.visualY) * (1 - Math.exp(-STAIRS_SMOOTHING_SPEED * dt)); // smooths stair steps
    const dx = body.x - this.lastX;
    const dz = body.z - this.lastZ;
    const moved = Math.hypot(dx, dz);
    this.lastX = body.x;
    this.lastZ = body.z;

    this.robot.setPosition(body.x, this.visualY, body.z);
    const moving = moved > MOVING_BELOW;
    this.robot.update(dt, heading, moving ? dx / moved : 0, moving ? dz / moved : 0, false);

    this.label.sprite.visible = showLabel;
    if (showLabel) this.label.set(brain ? `${brain.goalLabel}: ${brain.actionLabel}` : kind.label);
  }
}
