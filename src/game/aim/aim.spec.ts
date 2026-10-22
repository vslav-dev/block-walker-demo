import { NORTH, wrapAngle } from '@game/core/angles';
import { Aim } from './aim';

const settings = { mouseSensitivity: 1 };
const EAST = Math.PI / 2; // yaw of +x
const close = (a: number, b: number, message: string) => expect(Math.abs(wrapAngle(a - b)), `${message}: ${a} vs ${b}`).toBeLessThan(0.01);

function run(aim: Aim, seconds: number, aiming: boolean, lookX: number, cursorYaw: number | null) {
  for (let t = 0; t < seconds; t += 1 / 60) aim.update(1 / 60, aiming, t === 0 ? lookX : 0, cursorYaw);
}

// Pixels of mouse movement that turn the view to the right by this many degrees, at the sensitivity 1.
const pixels = (degrees: number) => ((degrees * Math.PI) / 180) / 0.0015;

// Turns the view right by `degrees` in one aim, releases it and lets the camera settle. The character looks north at first.
function turnAndRelease(aim: Aim, degrees: number) {
  run(aim, 1, false, 0, NORTH);
  run(aim, 0.1, true, 0, null);
  run(aim, 0.1, true, pixels(degrees), null);
  run(aim, 2, false, 0, null);
}

describe('Aim', () => {
  it('in the overview the character looks at the cursor and the camera north', () => {
    const aim = new Aim(settings);
    run(aim, 1, false, 0, EAST);
    close(aim.yaw, EAST, 'yaw');
    close(aim.heading, NORTH, 'heading');
    run(aim, 1, false, 0, null);
    close(aim.yaw, EAST, 'a cursor over the character changes nothing');
  });

  it('the aim starts from where the character looks, so looking north changes nothing', () => {
    const aim = new Aim(settings);
    run(aim, 1, false, 0, NORTH);
    run(aim, 0.1, true, 0, NORTH);
    close(aim.heading, NORTH, 'heading');
    close(aim.yaw, NORTH, 'yaw');

    const east = new Aim(settings);
    run(east, 1, false, 0, EAST);
    run(east, 0.1, true, 0, null);
    close(east.heading, EAST, 'the camera turns to where the character looks');
  });

  it('while aiming the mouse turns the view and the character with it, the cursor is ignored', () => {
    const aim = new Aim(settings);
    run(aim, 1, false, 0, NORTH);
    run(aim, 1, true, 100, EAST); // 100 px to the right
    close(aim.heading, NORTH - 0.15, 'turning right lowers the yaw');
    close(aim.yaw, aim.heading, 'the character looks where the camera looks');
  });

  it('the mouse sensitivity of the settings scales the turn', () => {
    const aim = new Aim({ mouseSensitivity: 2 });
    run(aim, 1, false, 0, NORTH);
    run(aim, 1, true, 100, null);
    close(aim.heading, NORTH - 0.3, 'twice the turn');
  });

  it('releasing the aim leaves the camera on the nearest of the four directions, on the side it was turned to', () => {
    const quarter = Math.PI / 2;
    for (const [degrees, turns] of [[10, 0], [40, 0], [50, 1], [90, 1], [130, 1], [140, 2], [180, 2], [220, 2], [230, 3], [300, 3], [320, 4], [-50, -1], [-140, -2]]) {
      const aim = new Aim(settings);
      turnAndRelease(aim, degrees);
      close(aim.heading, NORTH - turns * quarter, `after ${degrees}° to the right`);
    }
    const spins = new Aim(settings);
    turnAndRelease(spins, 3 * 360 + 100); // three whole turns and a bit
    close(spins.heading, NORTH - quarter, 'any number of turns counts only by where the view stopped');
  });

  it('the next aim and release start from the camera as it is, and the camera follows its new directions', () => {
    const aim = new Aim(settings);
    turnAndRelease(aim, 180); // the camera looks south now
    run(aim, 0.1, true, 0, null);
    close(aim.heading, aim.yaw, 'the aim starts from where the character looks');
    turnAndRelease(aim, 100); // from where the character looked, which was not the camera's
    close(Math.abs(wrapAngle(aim.heading - NORTH)) % (Math.PI / 2), 0, 'always one of the four directions');
  });
});
