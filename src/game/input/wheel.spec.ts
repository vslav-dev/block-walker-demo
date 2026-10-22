import { wheelPixels } from './wheel';

describe('wheelPixels', () => {
  it('wheel events are brought to pixels, whatever their unit, and one event is limited', () => {
    expect(wheelPixels(3, 0, 800), 'pixels as they are: a smooth swipe').toBe(3);
    expect(wheelPixels(1, 1, 800), 'a line').toBe(18);
    expect(wheelPixels(-1, 2, 40), 'a page').toBe(-40);
    expect(wheelPixels(500, 0, 800), 'limited').toBe(60);
    expect(wheelPixels(-500, 0, 800), 'limited the other way').toBe(-60);
  });
});
