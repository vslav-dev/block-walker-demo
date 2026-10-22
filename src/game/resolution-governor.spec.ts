import { ResolutionGovernor } from './resolution-governor';

// Plays `seconds` of frames of this length; returns the changes of the ratio that it asked for.
function play(governor: ResolutionGovernor, seconds: number, frame: number): number[] {
  const changes: number[] = [];
  for (let t = 0; t < seconds; t += frame) {
    const ratio = governor.update(frame);
    if (ratio !== null) changes.push(ratio);
  }
  return changes;
}

const ON_TIME = 1 / 60;
const LATE = 1 / 30;

describe('ResolutionGovernor', () => {
  it('leaves the ratio as it is while the frames are on time', () => {
    const governor = new ResolutionGovernor(2, 2);
    expect(play(governor, 60, ON_TIME)).toEqual([]);
  });

  it('says nothing in the first seconds, however late the frames are', () => {
    const governor = new ResolutionGovernor(2, 2);
    expect(play(governor, 1.9, LATE)).toEqual([]);
  });

  it('goes down a step for every window of late frames, and not below the least', () => {
    const governor = new ResolutionGovernor(2, 2);
    play(governor, 2, LATE);
    expect(play(governor, 3.1, LATE)).toEqual([1.75, 1.5, 1.25]);
    play(governor, 20, LATE);
    expect(governor.ratio).toBe(0.5);
  });

  it('a stall is not a window of late frames', () => {
    const governor = new ResolutionGovernor(2, 2);
    play(governor, 2, ON_TIME);
    expect(governor.update(5)).toBeNull(); // a tab that was hidden
    expect(play(governor, 4, ON_TIME)).toEqual([]);
  });

  it('goes up again after a calm while, but never to a level that was too slow', () => {
    const governor = new ResolutionGovernor(2, 2);
    play(governor, 2, ON_TIME);
    play(governor, 1.1, LATE); // too slow at 2
    expect(governor.ratio).toBe(1.75);
    expect(play(governor, 20, ON_TIME), '1.75 + a step is the level that was too slow').toEqual([]);
  });

  it('tries the level that was too slow again, after it has been forgotten', () => {
    const governor = new ResolutionGovernor(2, 2);
    play(governor, 2, ON_TIME);
    play(governor, 1.1, LATE);
    expect(play(governor, 40, ON_TIME)).toEqual([2]);
  });

  it('goes up to the most that was given, no further', () => {
    const governor = new ResolutionGovernor(1, 1.5);
    play(governor, 2, ON_TIME);
    expect(play(governor, 60, ON_TIME)).toEqual([1.25, 1.5]);
  });
});
