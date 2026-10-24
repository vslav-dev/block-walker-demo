import { ActionStatus, type Action } from '@game/sim/brain/action';

// Stands where it is for a time. Doing nothing is an action like the others: a creature is never without one.
export class Wait implements Action {
  readonly interruptible = true;
  private elapsed = 0;

  constructor(
    readonly label: string,
    private readonly seconds: number,
  ) {}

  update(_self: unknown, _sim: unknown, dt: number): ActionStatus {
    this.elapsed += dt;
    return this.elapsed >= this.seconds ? ActionStatus.Done : ActionStatus.Running;
  }
}
