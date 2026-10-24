import { NEEDS, NEED_MAX, NeedId, Needs, urgencyOf } from './needs';

describe('needs', () => {
  it('the urgency is 1 where the need presses, small below it, and climbs steeply past it', () => {
    const { pressing } = NEEDS[NeedId.Hunger];
    expect(urgencyOf(NeedId.Hunger, pressing)).toBeCloseTo(1);
    expect(urgencyOf(NeedId.Hunger, 0)).toBe(0);
    expect(urgencyOf(NeedId.Hunger, pressing / 2)).toBeLessThan(0.2);
    expect(urgencyOf(NeedId.Hunger, NEED_MAX)).toBeGreaterThan(2);
  });

  it('the urgency only grows with the level', () => {
    let last = -1;
    for (let level = 0; level <= NEED_MAX; level += 0.05) {
      const urgency = urgencyOf(NeedId.Hunger, level);
      expect(urgency).toBeGreaterThan(last);
      last = urgency;
    }
  });

  it('a need grows with time at its rate, up to the most, and is relieved down to nothing', () => {
    const needs = new Needs([NeedId.Hunger], () => 0.5);
    needs.tick(30);
    expect(needs.level(NeedId.Hunger)).toBeCloseTo(0.5 + 30 * NEEDS[NeedId.Hunger].rate);
    needs.tick(1e6);
    expect(needs.level(NeedId.Hunger)).toBe(NEED_MAX);
    needs.relieve(NeedId.Hunger, 0.3);
    expect(needs.level(NeedId.Hunger)).toBeCloseTo(NEED_MAX - 0.3);
    needs.relieve(NeedId.Hunger, 10);
    expect(needs.level(NeedId.Hunger)).toBe(0);
  });

  it('a creature has only the needs of its kind, and a need it has not is never urgent', () => {
    const needs = new Needs([], () => 0.9);
    needs.tick(100);
    expect(needs.level(NeedId.Hunger)).toBe(0);
    expect(needs.urgency(NeedId.Hunger)).toBe(0);
  });
});
